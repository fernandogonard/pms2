// scripts/seedRooms.js
// Seed de 40 habitaciones: 20 dobles, 12 triples, 8 cuádruples
// Uso: node scripts/seedRooms.js

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/Room');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://matiasgonard1_db_user:RHSQQGbznTlVsbOC@pms2.pcm2o1i.mongodb.net/crm_hotelero?retryWrites=true&w=majority&appName=pms2';

// Precios por tipo (en pesos argentinos)
const PRICES = {
  doble:      8500,
  triple:    11500,
  cuadruple: 15000,
};

// Distribución por piso: 5 dobles + 3 triples + 2 cuádruples = 10 por piso × 4 pisos = 40
// Números: piso 1 → 101-110, piso 2 → 201-210, piso 3 → 301-310, piso 4 → 401-410
const LAYOUT_PER_FLOOR = [
  { num: 1, type: 'doble' },
  { num: 2, type: 'doble' },
  { num: 3, type: 'doble' },
  { num: 4, type: 'doble' },
  { num: 5, type: 'doble' },
  { num: 6, type: 'triple' },
  { num: 7, type: 'triple' },
  { num: 8, type: 'triple' },
  { num: 9, type: 'cuadruple' },
  { num: 10, type: 'cuadruple' },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB');

  const existing = await Room.countDocuments();
  if (existing > 0) {
    console.log(`Ya existen ${existing} habitaciones. ¿Desea reemplazarlas? (ejecutar con --force para confirmar)`);
    if (!process.argv.includes('--force')) {
      await mongoose.disconnect();
      process.exit(0);
    }
    await Room.deleteMany({});
    console.log('Habitaciones anteriores eliminadas.');
  }

  const rooms = [];
  for (let floor = 1; floor <= 4; floor++) {
    for (const cell of LAYOUT_PER_FLOOR) {
      const roomNumber = floor * 100 + cell.num;
      rooms.push({
        number: roomNumber,
        floor,
        type: cell.type,
        price: PRICES[cell.type],
        status: 'disponible',
      });
    }
  }

  await Room.insertMany(rooms);

  const counts = rooms.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
  console.log(`\n✅ ${rooms.length} habitaciones creadas:`);
  Object.entries(counts).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} (pisos 1-4, $${PRICES[type].toLocaleString('es-AR')}/noche)`);
  });
  console.log('\nNúmeros de habitación:');
  for (let floor = 1; floor <= 4; floor++) {
    const floorRooms = rooms.filter(r => r.floor === floor);
    console.log(`  Piso ${floor}: ${floorRooms.map(r => `${r.number}(${r.type[0].toUpperCase()})`).join('  ')}`);
  }

  await mongoose.disconnect();
  console.log('\nListo.');
}

seed().catch(err => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
