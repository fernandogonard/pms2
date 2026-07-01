const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Room = require('../models/Room');
const Client = require('../models/Client');
const Reservation = require('../models/Reservation');
const { EventMatrixService } = require('../services/eventMatrixService');
const { EVENT_TYPES } = require('../models/eventTypes');
const { clearDiagnostics, DIAG_FILE } = require('../services/temporaryHttpDiagnostics');

const BASE = process.env.STRESS_BASE_URL || 'http://localhost:3001';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function api(method, url, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const start = performance.now();
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const elapsed = performance.now() - start;
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, elapsedMs: elapsed, body: json };
}

function summarizeStack(stack) {
  if (!stack) return null;
  return String(stack)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function classifyError({ status, body, diag }) {
  const message = String(
    body?.message || body?.error || diag?.errorMessage || ''
  ).toLowerCase();
  const stack = String(diag?.errorStack || '').toLowerCase();

  if (status === 401 || message.includes('token') || message.includes('no autorizado') || message.includes('unauthorized')) {
    return 'JWT failure';
  }
  if (status === 429 || message.includes('demasiadas solicitudes') || message.includes('rate')) {
    return 'Rate limiter';
  }
  if (message.includes('timed out') || message.includes('timeout') || stack.includes('mongoserverselectionerror') || stack.includes('buffering timed out')) {
    return 'Mongo timeout';
  }
  if (message.includes('heap out of memory') || message.includes('allocation failed') || message.includes('memory')) {
    return 'Memory pressure';
  }
  if (message.includes('cannot read properties') || message.includes('undefined') || message.includes('null') || stack.includes('typeerror')) {
    return 'Null reference';
  }
  if (message.includes('validation') || message.includes('casterror') || message.includes('joi')) {
    return 'Validation error';
  }
  if (message.includes('unhandled promise rejection') || stack.includes('unhandledrejection')) {
    return 'Unhandled promise rejection';
  }
  return 'Otro';
}

function parseDiagnosticsFile() {
  if (!fs.existsSync(DIAG_FILE)) return [];

  const raw = fs.readFileSync(DIAG_FILE, 'utf8');
  if (!raw.trim()) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_err) {
        return null;
      }
    })
    .filter(Boolean);
}

function buildErrorTop10(httpErrors, diagnostics) {
  const byRequestId = new Map();
  diagnostics.forEach((entry) => {
    if (entry.requestId) byRequestId.set(entry.requestId, entry);
  });

  const grouped = new Map();

  httpErrors.forEach((error) => {
    const diag = error.requestId ? byRequestId.get(error.requestId) : null;
    const category = classifyError({ status: error.status, body: error.body, diag });

    const sourceFile = diag?.sourceFile || (category === 'JWT failure' ? 'middlewares/authMiddleware.js' : null);
    const sourceLine = diag?.sourceLine || (category === 'JWT failure' ? 8 : null);
    const endpoint = error.endpoint;
    const signature = `${category}|${endpoint}|${sourceFile || 'unknown'}|${sourceLine || '0'}|${error.status}`;

    if (!grouped.has(signature)) {
      grouped.set(signature, {
        category,
        endpoint,
        status: error.status,
        occurrences: 0,
        stacktraceSummary: diag?.stackSummary || summarizeStack(diag?.errorStack) || summarizeStack(error.body?.stack) || null,
        sourceFile,
        sourceLine,
        sampleMessage: error.body?.message || error.body?.error || diag?.errorMessage || 'Sin mensaje'
      });
    }

    grouped.get(signature).occurrences += 1;
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);
}

async function prepareDataset() {
  await mongoose.connect(MONGO_URI);

  // Limpiar dataset previo de stress
  const stressClients = await Client.find({ email: /^stress_user_.*@hotel\.com$/i }, { _id: 1 }).lean();
  const stressClientIds = stressClients.map((c) => c._id);
  if (stressClientIds.length > 0) {
    await Reservation.deleteMany({ client: { $in: stressClientIds } });
    await Client.deleteMany({ _id: { $in: stressClientIds } });
  }

  // Asegurar 500 habitaciones
  const roomCount = await Room.countDocuments({ mode: 'production' });
  const missingRooms = Math.max(0, 500 - roomCount);
  const maxRoom = await Room.findOne({}).sort({ number: -1 }).lean();
  let nextRoomNumber = (maxRoom?.number || 1000) + 1;

  if (missingRooms > 0) {
    const roomDocs = [];
    const types = ['doble', 'triple', 'cuadruple', 'suite'];
    for (let i = 0; i < missingRooms; i += 1) {
      roomDocs.push({
        number: nextRoomNumber++,
        floor: randomInt(1, 20),
        type: types[i % types.length],
        price: randomInt(8000, 30000),
        status: 'disponible',
        mode: 'production',
        housekeepingState: 'CLEAN'
      });
    }
    await Room.insertMany(roomDocs, { ordered: false });
  }

  const allRooms = await Room.find({ mode: 'production' }).sort({ number: 1 }).lean();

  // Crear 1000 clientes de stress
  const clientDocs = [];
  const stamp = Date.now();
  for (let i = 0; i < 1000; i += 1) {
    clientDocs.push({
      nombre: 'Stress',
      apellido: `User${i}`,
      dni: `STRESS-${stamp}-${i}`,
      email: `stress_user_${stamp}_${i}@hotel.com`,
      whatsapp: `223${String(1000000 + i).slice(-7)}`
    });
  }
  const createdClients = await Client.insertMany(clientDocs, { ordered: false });

  // Crear 1000 reservas (distribución round-robin sobre habitaciones)
  const reservations = [];
  const baseDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < 1000; i += 1) {
    const room = allRooms[i % allRooms.length];
    const checkIn = new Date(baseDate.getTime() + (i % 30) * 24 * 60 * 60 * 1000);
    const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
    const nights = 1;
    const subtotal = room.price * nights;
    const taxes = subtotal * 0.21;
    const total = subtotal + taxes;

    reservations.push({
      tipo: room.type,
      cantidad: 1,
      room: [room._id],
      client: createdClients[i]._id,
      checkIn,
      checkOut,
      status: 'reservada',
      mode: 'production',
      pricing: {
        pricePerNight: room.price,
        totalNights: nights,
        subtotal,
        taxes,
        total,
        currency: 'ARS'
      },
      payment: {
        status: 'pendiente',
        method: 'efectivo',
        amountPaid: 0
      },
      paymentHistory: [],
      extras: [],
      invoice: { isPaid: false }
    });
  }
  await Reservation.insertMany(reservations, { ordered: false });

  await mongoose.disconnect();

  const eventMatrixSeed = reservations.flatMap((reservation) => {
    const roomId = reservation.room[0];
    return [
      {
        roomId,
        reservationId: reservation._id,
        type: EVENT_TYPES.RESERVATION_CREATED,
        timestamp: reservation.checkIn,
        metadata: {
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          requestId: 'stress-seed'
        }
      },
      {
        roomId,
        reservationId: reservation._id,
        type: EVENT_TYPES.CHECKIN,
        timestamp: reservation.checkIn,
        metadata: { requestId: 'stress-seed' }
      },
      {
        roomId,
        reservationId: reservation._id,
        type: EVENT_TYPES.CHECKOUT,
        timestamp: reservation.checkOut,
        metadata: { requestId: 'stress-seed' }
      }
    ];
  });

  return {
    rooms: allRooms.length,
    reservationsInserted: reservations.length,
    clientsInserted: createdClients.length,
    eventMatrixSeed
  };
}

function benchmarkEventMatrix(seedEvents = []) {
  const roomIds = Array.from(new Set(seedEvents.map((event) => String(event.roomId))));
  const dates = ['2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'];
  const eventMatrix = new EventMatrixService({ timeZone: 'America/Argentina/Buenos_Aires' });
  eventMatrix.setEvents(seedEvents);

  const timings = [];
  const start = performance.now();

  for (let i = 0; i < roomIds.length; i += 1) {
    const roomId = roomIds[i];
    for (let j = 0; j < dates.length; j += 1) {
      const t0 = performance.now();
      eventMatrix.buildDayTimeline(roomId, dates[j]);
      timings.push(performance.now() - t0);
    }
  }

  const totalMs = performance.now() - start;
  return {
    roomsMeasured: roomIds.length,
    datesMeasuredPerRoom: dates.length,
    timelineRequests: timings.length,
    avgMs: Number((timings.reduce((acc, value) => acc + value, 0) / (timings.length || 1)).toFixed(2)),
    p95Ms: Number(percentile(timings, 95).toFixed(2)),
    maxMs: Number((timings.length ? Math.max(...timings) : 0).toFixed(2)),
    totalMs: Number(totalMs.toFixed(2))
  };
}

async function runStress(seedEvents = []) {
  clearDiagnostics();

  const healthBefore = await api('GET', '/api/system/health');

  const login = await api('POST', '/api/auth/login', {
    body: { email: 'admin@hotel.com', password: 'admin123' }
  });
  const token = login.body?.token;
  if (!token) {
    throw new Error(`No se obtuvo token de login. status=${login.status}`);
  }

  const endpoints = [
    { key: 'health', weight: 0.3, fn: () => api('GET', '/api/system/health', { token }) },
    { key: 'availability', weight: 0.5, fn: () => api('GET', `/api/rooms/status?start=${new Date().toISOString().slice(0, 10)}&days=7`, { token }) },
    { key: 'reservationsList', weight: 0.2, fn: () => api('GET', '/api/reservations?page=1&limit=50', { token }) }
  ];

  function pickEndpoint() {
    const r = Math.random();
    let acc = 0;
    for (const e of endpoints) {
      acc += e.weight;
      if (r <= acc) return e;
    }
    return endpoints[endpoints.length - 1];
  }

  const concurrentUsers = 50;
  const iterationsPerUser = 20;
  const endpointTimes = {
    health: [],
    availability: [],
    reservationsList: []
  };
  const statusCounts = {};
  const httpErrors = [];

  async function worker() {
    for (let i = 0; i < iterationsPerUser; i += 1) {
      const endpoint = pickEndpoint();
      const result = await endpoint.fn();
      endpointTimes[endpoint.key].push(result.elapsedMs);
      const statusKey = `${endpoint.key}:${result.status}`;
      statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;

      if (result.status >= 400) {
        httpErrors.push({
          endpoint: endpoint.key,
          status: result.status,
          elapsedMs: Number(result.elapsedMs.toFixed(2)),
          requestId: result.body?.requestId || null,
          body: result.body
        });
      }
    }
  }

  const startAll = performance.now();
  await Promise.all(Array.from({ length: concurrentUsers }, () => worker()));
  const totalElapsed = performance.now() - startAll;

  const healthAfter = await api('GET', '/api/system/health');
  const eventMatrixTimeline = benchmarkEventMatrix(seedEvents);
  const diagnostics = parseDiagnosticsFile();
  const topErrors = buildErrorTop10(httpErrors, diagnostics);

  const summaryByEndpoint = {};
  for (const [key, times] of Object.entries(endpointTimes)) {
    summaryByEndpoint[key] = {
      requests: times.length,
      p50Ms: Number(percentile(times, 50).toFixed(2)),
      p95Ms: Number(percentile(times, 95).toFixed(2)),
      p99Ms: Number(percentile(times, 99).toFixed(2)),
      maxMs: Number((times.length ? Math.max(...times) : 0).toFixed(2)),
      avgMs: Number((times.length ? (times.reduce((a, b) => a + b, 0) / times.length) : 0).toFixed(2))
    };
  }

  return {
    concurrentUsers,
    iterationsPerUser,
    totalRequests: concurrentUsers * iterationsPerUser,
    totalDurationMs: Number(totalElapsed.toFixed(2)),
    requestsPerSecond: Number(((concurrentUsers * iterationsPerUser) / (totalElapsed / 1000)).toFixed(2)),
    statusCounts,
    endpoints: summaryByEndpoint,
    timelineResolution: eventMatrixTimeline,
    diagnostics: {
      diagFile: DIAG_FILE,
      totalHttpErrors: httpErrors.length,
      totalEndpointDiagnostics: diagnostics.length,
      top10Errors: topErrors
    },
    memory: {
      before: healthBefore.body?.memory || null,
      after: healthAfter.body?.memory || null
    }
  };
}

(async () => {
  const dataset = await prepareDataset();
  const stress = await runStress(dataset.eventMatrixSeed);

  const output = {
    generatedAt: new Date().toISOString(),
    dataset: {
      rooms: dataset.rooms,
      reservationsInserted: dataset.reservationsInserted,
      clientsInserted: dataset.clientsInserted
    },
    stress,
    bottlenecks: Object.entries(stress.endpoints)
      .filter(([, metrics]) => metrics.p95Ms > 500)
      .map(([endpoint, metrics]) => ({ endpoint, p95Ms: metrics.p95Ms, note: 'P95 excede 500ms' }))
  };

  const outPath = path.resolve(__dirname, '../STRESS-TEST-RAW.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify({ ok: true, outPath, totalRequests: stress.totalRequests, rps: stress.requestsPerSecond }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});