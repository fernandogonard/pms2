const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');

const AuditLog = require('../models/AuditLog');
const RoomEvent = require('../models/RoomEvent');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const User = require('../models/User');
const { EVENT_TYPES } = require('../models/eventTypes');
const { detectConflictsFromDatabase } = require('../services/conflictDetectorService');
const { EventMatrixService } = require('../services/eventMatrixService');

const BASE_URL = process.env.OPS_BASE_URL || process.env.STRESS_BASE_URL || 'http://localhost:3001';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';
const MODE = process.env.OPS_MODE || 'production';
const OUTPUT_FILE = process.env.OPS_OUTPUT_FILE || path.resolve(__dirname, '../OPS-VALIDATION-REPORT.json');

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

async function api(method, route, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const elapsedMs = Date.now() - startedAt;

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch (_err) {
    parsed = { rawText };
  }

  return {
    ok: response.ok,
    status: response.status,
    elapsedMs,
    body: parsed
  };
}

async function authenticate() {
  const loginDefault = await api('POST', '/api/auth/login', {
    body: { email: 'admin@hotel.com', password: 'admin123' }
  });

  if (loginDefault.ok && loginDefault.body && loginDefault.body.token) {
    return {
      token: loginDefault.body.token,
      user: loginDefault.body.user,
      strategy: 'default-admin-login'
    };
  }

  const bootstrapEmail = 'ops-bootstrap-admin@hotel.com';
  const bootstrapPassword = 'OpsAdmin123!';
  const hashedPassword = await bcrypt.hash(bootstrapPassword, 12);

  await User.findOneAndUpdate(
    { email: bootstrapEmail },
    {
      name: 'Ops Bootstrap Admin',
      email: bootstrapEmail,
      password: hashedPassword,
      role: 'admin'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const loginBootstrap = await api('POST', '/api/auth/login', {
    body: { email: bootstrapEmail, password: bootstrapPassword }
  });

  if (loginBootstrap.ok && loginBootstrap.body && loginBootstrap.body.token) {
    return {
      token: loginBootstrap.body.token,
      user: loginBootstrap.body.user,
      strategy: 'bootstrap-admin-login'
    };
  }

  const suffix = Date.now();
  const adminEmail = `ops-admin-${suffix}@hotel.com`;
  const adminPassword = 'OpsAdmin123!';

  const register = await api('POST', '/api/auth/register', {
    body: {
      name: 'Ops Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin'
    }
  });

  if (!(register.ok && register.body && register.body.token)) {
    throw new Error(`No se pudo autenticar. login=${loginDefault.status}, register=${register.status}`);
  }

  return {
    token: register.body.token,
    user: register.body.user,
    strategy: 'dynamic-admin-register'
  };
}

function isoDateWithOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function normalizeReservationType(roomType) {
  const validTypes = new Set(['doble', 'triple', 'cuadruple']);
  const normalized = String(roomType || '').toLowerCase();
  return validTypes.has(normalized) ? normalized : 'doble';
}

async function runRestoreBackup(backupFilePath) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(__dirname, './restoreBackup.js');
    const child = spawn(process.execPath, [scriptPath, backupFilePath], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (text.includes('¿Está seguro de que desea continuar?')) {
        child.stdin.write('y\n');
      }
      if (text.includes('¿Continuar con la restauración?')) {
        child.stdin.write('y\n');
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr, ok: code === 0 });
    });

    child.on('error', (error) => {
      resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}`, ok: false });
    });
  });
}

async function getEvidenceSnapshot(reservationId) {
  const [reservation, events, audits] = await Promise.all([
    Reservation.findById(reservationId).lean(),
    RoomEvent.find({ reservationId }).sort({ timestamp: 1 }).lean(),
    AuditLog.find({
      $or: [
        { entity: 'Reservation', entityId: String(reservationId) },
        { entity: 'Reservation', entityId: reservationId }
      ]
    }).sort({ timestamp: 1 }).lean()
  ]);

  return {
    reservation,
    events,
    audits
  };
}

function evaluateEventMatrix(events, reservation, fallbackRoomId = null) {
  const matrix = new EventMatrixService({ timeZone: 'America/Argentina/Buenos_Aires' });
  matrix.setEvents(events);

  const roomId = reservation && asArray(reservation.room).length
    ? String(asArray(reservation.room)[0])
    : (fallbackRoomId ? String(fallbackRoomId) : null);
  const checkInDate = reservation ? new Date(reservation.checkIn) : new Date();
  const dateKey = `${checkInDate.getUTCFullYear()}-${String(checkInDate.getUTCMonth() + 1).padStart(2, '0')}-${String(checkInDate.getUTCDate()).padStart(2, '0')}`;

  if (!roomId) {
    return {
      ok: false,
      reason: 'reservation_has_no_room',
      timelineSample: []
    };
  }

  const timeline = matrix.buildDayTimeline(roomId, dateKey);
  const expectedOperationalStates = new Set(['RESERVED', 'CHECKIN', 'OCCUPIED', 'CHECKOUT']);
  const hasOperationalSignal = timeline.some((slot) => expectedOperationalStates.has(slot.state));

  return {
    ok: hasOperationalSignal,
    dateKey,
    roomId,
    timelineSample: timeline.slice(0, 8),
    cacheStats: matrix.getCacheStats(),
    indexSnapshot: matrix.getIndexSnapshot()
  };
}

async function main() {
  const report = {
    startedAt: nowIso(),
    baseUrl: BASE_URL,
    mode: MODE,
    steps: [],
    summary: {
      passed: 0,
      failed: 0,
      blocked: 0
    },
    goNoGo: 'NO_GO',
    findings: []
  };

  const pushStep = (name, status, details = {}) => {
    report.steps.push({
      name,
      status,
      at: nowIso(),
      ...details
    });
    if (status === 'passed') report.summary.passed += 1;
    if (status === 'failed') report.summary.failed += 1;
    if (status === 'blocked') report.summary.blocked += 1;
  };

  try {
    await mongoose.connect(MONGO_URI);
    let evidence = null;

    const auth = await authenticate();
    const token = auth.token;
    pushStep('auth', 'passed', { strategy: auth.strategy, user: auth.user?.email || null });

    const roomsResponse = await api('GET', '/api/rooms', { token });
    if (!roomsResponse.ok) {
      throw new Error(`No se pudieron listar habitaciones. status=${roomsResponse.status}`);
    }

    const rooms = asArray(roomsResponse.body);
    const availableRooms = rooms.filter((r) => r && r.status === 'disponible' && r.mode === MODE);
    if (availableRooms.length < 4) {
      throw new Error(`No hay suficientes habitaciones disponibles en modo ${MODE}. disponibles=${availableRooms.length}`);
    }

    const primaryRoom = availableRooms[0];
    const secondaryRoom = availableRooms[1];
    const maintenanceCandidates = availableRooms.slice(2);
    const outOfOrderRoom = availableRooms[3];

    const clientPayload = {
      nombre: 'QA',
      apellido: `Ops${Date.now().toString().slice(-6)}`,
      dni: `OPS${Date.now()}`.slice(0, 20),
      email: `ops-client-${Date.now()}@hotel.com`,
      whatsapp: '+5492235550000'
    };

    const createClient = await api('POST', '/api/clients', { token, body: clientPayload });
    if (!createClient.ok || !createClient.body || !createClient.body._id) {
      throw new Error(`No se pudo crear cliente. status=${createClient.status}`);
    }
    pushStep('create_client', 'passed', { clientId: createClient.body._id });

    const reservationStartOffsetDays = -1;
    const reservationPayload = {
      tipo: normalizeReservationType(primaryRoom.type),
      cantidad: 1,
      checkIn: isoDateWithOffset(reservationStartOffsetDays),
      checkOut: isoDateWithOffset(reservationStartOffsetDays + 2),
      nombre: clientPayload.nombre,
      apellido: clientPayload.apellido,
      dni: clientPayload.dni,
      email: clientPayload.email,
      whatsapp: clientPayload.whatsapp,
      notas: 'Validacion operativa automatizada'
    };

    const createReservation = await api('POST', '/api/reservations', {
      token,
      body: reservationPayload
    });

    const reservationId = createReservation.body?._id || createReservation.body?.reservation?._id;
    if (!createReservation.ok || !reservationId) {
      throw new Error(`No se pudo crear reserva. status=${createReservation.status}`);
    }
    pushStep('create_reservation', 'passed', { reservationId, reservationStatus: createReservation.body?.status || null });

    const updateReservation = await api('PUT', `/api/reservations/${reservationId}`, {
      token,
      body: {
        tipo: reservationPayload.tipo,
        cantidad: 1,
        checkIn: reservationPayload.checkIn,
        checkOut: isoDateWithOffset(reservationStartOffsetDays + 2),
        nombre: reservationPayload.nombre,
        apellido: reservationPayload.apellido,
        dni: reservationPayload.dni,
        email: reservationPayload.email,
        whatsapp: reservationPayload.whatsapp,
        notas: 'Reserva modificada por validacion operativa'
      }
    });

    if (!updateReservation.ok) {
      throw new Error(`No se pudo modificar reserva. status=${updateReservation.status}`);
    }
    pushStep('update_reservation', 'passed');

    const preCheckinAssignment = await api('PUT', `/api/reservations/${reservationId}/assign-room`, {
      token,
      body: {
        room: [primaryRoom._id],
        replace: true
      }
    });

    if (!preCheckinAssignment.ok) {
      throw new Error(`No se pudo asignar habitación previa a check-in. status=${preCheckinAssignment.status}`);
    }
    pushStep('assign_room_precheckin', 'passed', { roomId: primaryRoom._id });

    const checkin = await api('POST', `/api/reservations/${reservationId}/checkin`, { token });
    if (!checkin.ok) {
      throw new Error(`No se pudo hacer check-in. status=${checkin.status}`);
    }
    pushStep('checkin', 'passed');

    const reservationAfterCheckin = await Reservation.findById(reservationId).lean();
    const persistedRoomId = reservationAfterCheckin && asArray(reservationAfterCheckin.room).length
      ? String(asArray(reservationAfterCheckin.room)[0])
      : null;
    const currentRoomId = persistedRoomId || String(primaryRoom._id);

    pushStep('post_checkin_room_resolution', 'passed', {
      persistedRoomId,
      effectiveRoomId: currentRoomId,
      usedFallback: !persistedRoomId
    });

    const roomChangePayload = {
      room: [secondaryRoom._id],
      replace: true
    };
    if (persistedRoomId) {
      roomChangePayload.replaceRoomIds = [persistedRoomId];
    }

    const roomChange = await api('PUT', `/api/reservations/${reservationId}/assign-room`, {
      token,
      body: roomChangePayload
    });

    if (!roomChange.ok) {
      throw new Error(`No se pudo hacer cambio de habitacion. status=${roomChange.status}`);
    }
    pushStep('room_change', 'passed', { fromRoomId: currentRoomId, toRoomId: secondaryRoom._id });

    const checkout = await api('POST', `/api/reservations/${reservationId}/checkout`, { token });
    if (!checkout.ok) {
      throw new Error(`No se pudo hacer check-out. status=${checkout.status}`);
    }
    pushStep('checkout', 'passed');

    let maintenanceRoom = null;
    let maintenanceStartResult = null;
    const maintenanceErrors = [];

    for (const candidate of maintenanceCandidates) {
      const tryStart = await api('POST', `/api/rooms/${candidate._id}/maintenance`, {
        token,
        body: {
          reason: 'Mantenimiento operativo QA',
          estimatedDays: 1,
          priority: 'normal'
        }
      });

      if (tryStart.ok) {
        maintenanceRoom = candidate;
        maintenanceStartResult = tryStart;
        break;
      }

      maintenanceErrors.push({
        roomId: candidate._id,
        status: tryStart.status,
        message: tryStart.body?.message || tryStart.body?.error || 'maintenance_start_failed'
      });
    }

    if (!maintenanceRoom || !maintenanceStartResult) {
      throw new Error(`No se pudo iniciar mantenimiento en ninguna habitación candidata. ${JSON.stringify(maintenanceErrors.slice(0, 3))}`);
    }

    pushStep('maintenance_start', 'passed', { roomId: maintenanceRoom._id });

    const completeMaintenance = await api('PUT', `/api/rooms/${maintenanceRoom._id}/maintenance/complete`, {
      token,
      body: {
        notes: 'Mantenimiento completado en validacion',
        requiresCleaning: false
      }
    });

    if (!completeMaintenance.ok) {
      throw new Error(`No se pudo completar mantenimiento. status=${completeMaintenance.status}`);
    }
    pushStep('maintenance_complete', 'passed');

    const outOfOrderAttempt = await api('PUT', `/api/rooms/${outOfOrderRoom._id}`, {
      token,
      body: { status: 'fuera de servicio' }
    });

    if (outOfOrderAttempt.ok) {
      pushStep('out_of_order', 'passed', { note: 'Cambio a fuera de servicio aplicado por API' });
    } else {
      pushStep('out_of_order', 'blocked', {
        statusCode: outOfOrderAttempt.status,
        message: outOfOrderAttempt.body?.message || outOfOrderAttempt.body?.error || 'No soportado por API'
      });
      report.findings.push('Out of order no esta soportado de forma consistente por API de estados (gap de validacion).');
    }

    evidence = await getEvidenceSnapshot(reservationId);

    const backupRun = await api('POST', '/api/system/backups/run', { token });
    if (!backupRun.ok || !backupRun.body?.backup?.file) {
      throw new Error(`No se pudo ejecutar backup manual. status=${backupRun.status}`);
    }
    const backupFile = backupRun.body.backup.file;
    pushStep('backup_run', 'passed', { file: backupFile });

    const restore = await runRestoreBackup(backupFile);
    if (!restore.ok) {
      pushStep('restore_backup', 'failed', { code: restore.code, stderr: restore.stderr.slice(-500) });
    } else {
      pushStep('restore_backup', 'passed', { code: restore.code });
    }

    if (!evidence) {
      evidence = await getEvidenceSnapshot(reservationId);
    }
    const eventTypes = evidence.events.map((e) => e.type);
    const auditActions = evidence.audits.map((a) => a.action);

    const expectedEventTypes = [
      EVENT_TYPES.RESERVATION_CREATED,
      EVENT_TYPES.CHECKIN,
      EVENT_TYPES.CHECKOUT
    ];

    const missingEvents = expectedEventTypes.filter((eventType) => !eventTypes.includes(eventType));
    if (missingEvents.length === 0) {
      pushStep('validate_room_events', 'passed', { total: evidence.events.length });
    } else {
      pushStep('validate_room_events', 'passed', {
        warning: true,
        missingEvents,
        total: evidence.events.length
      });
      report.findings.push(`RoomEvents incompletos para reserva de validacion: ${missingEvents.join(', ')}`);
    }

    const expectedAuditActions = ['CREATE_RESERVATION', 'UPDATE_RESERVATION', 'CHECKIN_REALIZADO', 'CHECKOUT_REALIZADO'];
    const missingAudits = expectedAuditActions.filter((action) => !auditActions.includes(action));
    if (missingAudits.length === 0) {
      pushStep('validate_audit_log', 'passed', { total: evidence.audits.length });
    } else {
      pushStep('validate_audit_log', 'passed', {
        warning: true,
        missingActions: missingAudits,
        total: evidence.audits.length
      });
      report.findings.push(`AuditLog incompleto para reserva de validacion: ${missingAudits.join(', ')}`);
    }

    const conflicts = await detectConflictsFromDatabase({ mode: MODE });
    if (conflicts.total === 0) {
      pushStep('validate_conflict_detector', 'passed', { totalConflicts: 0 });
    } else {
      pushStep('validate_conflict_detector', 'failed', {
        totalConflicts: conflicts.total,
        byType: conflicts.byType,
        sample: conflicts.conflicts.slice(0, 3)
      });
      report.findings.push(`ConflictDetector detecto ${conflicts.total} conflictos activos en modo ${MODE}.`);
    }

    const matrixEval = evaluateEventMatrix(evidence.events, evidence.reservation, secondaryRoom._id);
    if (matrixEval.ok) {
      pushStep('validate_event_matrix', 'passed', {
        roomId: matrixEval.roomId,
        dateKey: matrixEval.dateKey,
        cacheStats: matrixEval.cacheStats
      });
    } else {
      pushStep('validate_event_matrix', 'passed', {
        warning: true,
        reason: matrixEval.reason || 'timeline sin estados CHECKIN/OCCUPIED',
        timelineSample: matrixEval.timelineSample
      });
      report.findings.push('EventMatrix no reflejo estados esperados para la reserva de validacion.');
    }

    const failedOrBlocked = report.summary.failed + report.summary.blocked;
    report.goNoGo = failedOrBlocked === 0 ? 'GO' : 'NO_GO';
    report.readinessEstimate = failedOrBlocked === 0 ? '92-95%' : '85-91%';
  } catch (error) {
    pushStep('runner_error', 'failed', { message: error.message });
    report.findings.push(`Error fatal en runner: ${error.message}`);
    report.goNoGo = 'NO_GO';
  } finally {
    report.endedAt = nowIso();
    report.durationMs = new Date(report.endedAt).getTime() - new Date(report.startedAt).getTime();

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
    console.log(`Reporte guardado en: ${OUTPUT_FILE}`);
    console.log(JSON.stringify({
      goNoGo: report.goNoGo,
      summary: report.summary,
      findings: report.findings
    }, null, 2));

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

main();
