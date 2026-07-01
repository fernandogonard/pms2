// scripts/diagAvailabilityProcessing.js
// Aísla timing: Mongo query vs procesamiento Node del AvailabilityEngine
// Ejecución: node scripts/diagAvailabilityProcessing.js

const mongoose = require('mongoose');
const { performance } = require('perf_hooks');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
require('../models/Client'); // necesario para que populate funcione standalone
const { buildModeQuery } = require('../services/appModeService');
const { resolveRoomStatus } = require('../services/roomStatusResolutionService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

async function run() {
  await mongoose.connect(MONGO_URI);

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 7);
  const days = 7;
  const modeQuery = buildModeQuery('production');

  const RUNS = 3;

  console.log('=== DESGLOSE DE TIEMPOS (promedio de 3 runs) ===\n');

  const results = [];

  for (let run = 0; run < RUNS; run++) {
    // ── Fase 1: Query Mongo ─────────────────────────────────────
    const t1 = performance.now();
    const [rooms, reservations] = await Promise.all([
      Room.find(modeQuery).sort({ number: 1 }).lean(),
      Reservation.find({
        ...modeQuery,
        status: { $ne: 'cancelada' },
        checkIn: { $lt: endDate },
        checkOut: { $gt: startDate }
      }).populate('client', 'nombre apellido email').lean()
    ]);
    const mongoMs = performance.now() - t1;

    // ── Fase 2: Construcción del Map ──────────────────────────
    const t2 = performance.now();
    const reservationsByRoom = new Map();
    for (const r of reservations) {
      if (!r.room) continue;
      const roomIds = Array.isArray(r.room) ? r.room : [r.room];
      for (const rid of roomIds) {
        const key = rid.toString();
        if (!reservationsByRoom.has(key)) reservationsByRoom.set(key, []);
        reservationsByRoom.get(key).push(r);
      }
    }
    const mapMs = performance.now() - t2;

    // ── Fase 3: Loop rooms.map() + resolveRoomStatus ──────────
    const t3 = performance.now();
    const status = rooms.map(room => {
      const roomReservations = reservationsByRoom.get(room._id.toString()) || [];
      const dates = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setUTCDate(startDate.getUTCDate() + i);
        const resolved = resolveRoomStatus(room, roomReservations, date);
        dates.push({
          date: date.toISOString().split('T')[0],
          status: resolved.status
        });
      }
      return { roomId: room._id, dates };
    });
    const processMs = performance.now() - t3;

    const totalMs = mongoMs + mapMs + processMs;

    results.push({ mongoMs, mapMs, processMs, totalMs });

    console.log(`Run ${run + 1}:`);
    console.log(`  Mongo query (rooms + reservations parallel): ${mongoMs.toFixed(1)}ms`);
    console.log(`  Construcción Map O(n):                       ${mapMs.toFixed(1)}ms`);
    console.log(`  Loop rooms.map() + resolveRoomStatus:        ${processMs.toFixed(1)}ms`);
    console.log(`  TOTAL:                                       ${totalMs.toFixed(1)}ms`);
    console.log(`  rooms=${rooms.length} reservations=${reservations.length} output_rooms=${status.length}\n`);
  }

  const avg = field => results.reduce((s, r) => s + r[field], 0) / RUNS;
  const bottleneck = ['mongoMs', 'mapMs', 'processMs'].reduce((a, b) => avg(a) > avg(b) ? a : b);

  console.log('=== RESUMEN ===');
  console.log(`  Mongo avg:      ${avg('mongoMs').toFixed(1)}ms`);
  console.log(`  Map avg:        ${avg('mapMs').toFixed(1)}ms`);
  console.log(`  Process avg:    ${avg('processMs').toFixed(1)}ms`);
  console.log(`  TOTAL avg:      ${avg('totalMs').toFixed(1)}ms`);
  console.log(`\n  Cuello de botella: ${bottleneck.replace('Ms', '')}`);

  const processAvg = avg('processMs');
  const totalAvg = avg('totalMs');
  console.log(`  Node processing = ${((processAvg / totalAvg) * 100).toFixed(0)}% del tiempo total`);

  if (processAvg > 200) {
    console.log('\n⚠️  resolveRoomStatus es lento. Candidato a optimizar.');
    const perRoom = processAvg / results[0].totalMs * 1000;
    console.log(`  ≈${(processAvg / 500).toFixed(2)}ms por habitación × 500 habitaciones × 7 días`);
  } else {
    console.log('\n✅ Procesamiento en Node dentro del objetivo.');
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
