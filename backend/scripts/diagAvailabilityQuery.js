// scripts/diagAvailabilityQuery.js
// Diagnóstico de performance del query de availability
// Ejecución: node scripts/diagAvailabilityQuery.js

const mongoose = require('mongoose');
const { performance } = require('perf_hooks');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB conectado\n');

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 7);

  const modeQuery = { mode: 'production' };

  // ── 1. Contar documentos en colecciones ─────────────────────────────
  const [roomCount, reservationCount] = await Promise.all([
    Room.countDocuments(modeQuery),
    Reservation.countDocuments(modeQuery)
  ]);
  console.log(`Rooms (production):        ${roomCount}`);
  console.log(`Reservations (production): ${reservationCount}\n`);

  // ── 2. Índices reales en Mongo (lo que existe en disco, no solo schema) ─
  console.log('=== ÍNDICES REALES EN reservations ===');
  const col = mongoose.connection.db.collection('reservations');
  const indexes = await col.indexes();
  indexes.forEach(idx => {
    console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`);
  });
  console.log();

  // ── 3. Timing del query exacto que usa AvailabilityEngine ───────────
  const query = {
    ...modeQuery,
    status: { $ne: 'cancelada' },
    checkIn: { $lt: endDate },
    checkOut: { $gt: startDate }
  };

  const RUNS = 5;
  const timings = [];

  console.log('=== TIMING DEL QUERY (5 runs) ===');
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const docs = await Reservation.find(query).lean();
    const elapsed = performance.now() - t0;
    timings.push(elapsed);
    console.log(`  Run ${i + 1}: ${elapsed.toFixed(1)}ms — ${docs.length} docs`);
  }
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  console.log(`  avg=${avg.toFixed(1)}ms  min=${min.toFixed(1)}ms  max=${max.toFixed(1)}ms\n`);

  // ── 4. explain("executionStats") ────────────────────────────────────
  console.log('=== EXPLAIN executionStats ===');
  const explain = await col.find(query).explain('executionStats');
  const stats = explain.executionStats;
  const stage = explain.queryPlanner?.winningPlan?.stage ||
                explain.queryPlanner?.winningPlan?.inputStage?.stage || 'N/A';

  console.log(`  Stage:                   ${stage}`);
  console.log(`  nReturned:               ${stats.nReturned}`);
  console.log(`  totalDocsExamined:       ${stats.totalDocsExamined}`);
  console.log(`  totalKeysExamined:       ${stats.totalKeysExamined}`);
  console.log(`  executionTimeMillis:     ${stats.executionTimeMillis}ms`);

  const ratio = stats.totalDocsExamined > 0
    ? (stats.nReturned / stats.totalDocsExamined).toFixed(3)
    : 'N/A';
  console.log(`  selectivity ratio:       ${ratio}  (1.0 = perfecto, <0.1 = malo)\n`);

  // Obtener nombre del índice ganador
  const wp = explain.queryPlanner?.winningPlan;
  const indexName = wp?.indexName
    || wp?.inputStage?.indexName
    || wp?.inputStage?.inputStage?.indexName
    || 'N/A';
  console.log(`  Índice ganador:          ${indexName}`);

  // ── 5. Veredicto ────────────────────────────────────────────────────
  console.log('\n=== VEREDICTO ===');
  if (stage === 'COLLSCAN') {
    console.log('❌ COLLSCAN: Mongo escanea toda la colección. Índice no está siendo usado.');
  } else if (stage === 'FETCH' || stage === 'IXSCAN') {
    if (stats.totalKeysExamined <= stats.nReturned * 2) {
      console.log('✅ Query usa índice eficientemente.');
    } else {
      console.log(`⚠️  IXSCAN pero examina ${stats.totalKeysExamined} keys para ${stats.nReturned} docs — índice subóptimo.`);
    }
  } else {
    console.log(`Stage: ${stage} — revisar manualmente.`);
  }

  if (avg > 500) {
    console.log(`⚠️  Latencia avg=${avg.toFixed(0)}ms — por encima del objetivo de 500ms.`);
  } else {
    console.log(`✅ Latencia avg=${avg.toFixed(0)}ms dentro del objetivo.`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
