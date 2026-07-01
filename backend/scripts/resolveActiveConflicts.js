const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
require('../models/Client');
const { detectConflictsFromDatabase } = require('../services/conflictDetectorService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';
const MODE = process.env.OPS_MODE || 'production';
const OUT_FILE = path.resolve(__dirname, '../CONFLICT-RESOLUTION-REPORT.md');

function fmtDate(value) {
  if (!value) return 'N/A';
  return new Date(value).toISOString();
}

function classifyRootCause(conflict, room, reservations) {
  if (conflict.type === 'OVERBOOKING') {
    return 'dato inconsistente';
  }

  if (conflict.type === 'ROOM_BLOCKED_WITH_RESERVATION') {
    const hasActiveMaintenanceWindow = !!(
      room?.currentMaintenance?.startDate && room?.currentMaintenance?.estimatedEndDate
    );

    if (!hasActiveMaintenanceWindow) return 'dato inconsistente';

    const hasFutureBooked = reservations.some((r) => r.status === 'reservada');
    if (hasFutureBooked) return 'bug de negocio';

    return 'dato inconsistente';
  }

  return 'dato inconsistente';
}

function findLoserReservationForOverbooking(reservations) {
  const sorted = [...reservations].sort((a, b) => {
    const aScore = (a.status === 'checkin' ? 10 : 0) + new Date(a.createdAt || 0).getTime();
    const bScore = (b.status === 'checkin' ? 10 : 0) + new Date(b.createdAt || 0).getTime();
    return aScore - bScore;
  });

  return sorted[0] || null;
}

async function loadConflictDetails(conflict) {
  const room = await Room.findById(conflict.roomId).lean();
  const reservations = await Reservation.find({ _id: { $in: conflict.reservationIds } })
    .populate('client', 'nombre apellido email')
    .lean();

  return { room, reservations };
}

async function applyFix(conflict, room, reservations, dryRun = false) {
  const actions = [];

  if (conflict.type === 'OVERBOOKING') {
    const loser = findLoserReservationForOverbooking(reservations);
    if (loser) {
      actions.push({
        action: 'cancel_reservation_for_overbooking',
        reservationId: String(loser._id),
        previousStatus: loser.status,
        newStatus: 'cancelada'
      });

      if (!dryRun) {
        await Reservation.updateOne({ _id: loser._id }, { $set: { status: 'cancelada' } });
      }
    }
  }

  if (conflict.type === 'ROOM_BLOCKED_WITH_RESERVATION') {
    const activeReservations = reservations.filter((r) => ['reservada', 'checkin'].includes(r.status));
    const hasCurrentMaintenance = !!room?.currentMaintenance;

    if (hasCurrentMaintenance && activeReservations.length > 0) {
      actions.push({
        action: 'normalize_room_status_for_active_reservations',
        roomId: String(room._id),
        previousStatus: room.status,
        newStatus: 'ocupada'
      });

      if (!dryRun) {
        await Room.updateOne(
          { _id: room._id },
          {
            $set: { status: 'ocupada' },
            $unset: { currentMaintenance: '' }
          }
        );
      }
    }
  }

  return actions;
}

function conflictSection(conflict, room, reservations, rootCause, actions) {
  const roomLabel = room ? `#${room.number} (${room.type})` : conflict.roomId;
  const reservationLines = reservations.map((r) => {
    const clientName = r.client ? `${r.client.nombre || ''} ${r.client.apellido || ''}`.trim() : 'N/A';
    return `- Reserva ${r._id}: status=${r.status}, checkIn=${fmtDate(r.checkIn)}, checkOut=${fmtDate(r.checkOut)}, cliente=${clientName || 'N/A'}`;
  }).join('\n');

  const actionLines = actions.length
    ? actions.map((a) => `- ${a.action}: ${JSON.stringify(a)}`).join('\n')
    : '- Sin acciones aplicadas';

  return [
    `### ${conflict.type}`,
    `- Severidad: ${conflict.severity}`,
    `- Habitación: ${roomLabel}`,
    `- RoomId: ${conflict.roomId}`,
    `- Causa raíz clasificada: ${rootCause}`,
    '- Reservas involucradas:',
    reservationLines || '- N/A',
    '- Acciones aplicadas:',
    actionLines
  ].join('\n');
}

async function main() {
  await mongoose.connect(MONGO_URI);

  const before = await detectConflictsFromDatabase({ mode: MODE });
  const sections = [];
  const appliedActions = [];

  for (const conflict of before.conflicts) {
    const { room, reservations } = await loadConflictDetails(conflict);
    const rootCause = classifyRootCause(conflict, room, reservations);
    const actions = await applyFix(conflict, room, reservations, false);

    appliedActions.push(...actions);
    sections.push(conflictSection(conflict, room, reservations, rootCause, actions));
  }

  const after = await detectConflictsFromDatabase({ mode: MODE });

  const report = [
    '# CONFLICT-RESOLUTION-REPORT',
    '',
    `- Fecha: ${new Date().toISOString()}`,
    `- Modo: ${MODE}`,
    `- Conflictos iniciales: ${before.total}`,
    `- Conflictos finales: ${after.total}`,
    `- byType inicial: ${JSON.stringify(before.byType)}`,
    `- byType final: ${JSON.stringify(after.byType)}`,
    '',
    '## Detalle de conflictos y corrección',
    sections.join('\n\n'),
    '',
    '## Resumen de acciones',
    appliedActions.length
      ? appliedActions.map((a) => `- ${a.action} :: ${JSON.stringify(a)}`).join('\n')
      : '- No se aplicaron cambios',
    '',
    '## Resultado',
    after.total === 0
      ? '- Objetivo alcanzado: 0 conflictos activos.'
      : `- Objetivo NO alcanzado: ${after.total} conflictos activos remanentes.`
  ].join('\n');

  fs.writeFileSync(OUT_FILE, report, 'utf8');
  console.log(`Reporte: ${OUT_FILE}`);
  console.log(JSON.stringify({ before: before.total, after: after.total, byTypeAfter: after.byType }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
