// scripts/seedRoomTypes.js
// Seed de tipos de habitación con precios base
// Uso: node scripts/seedRoomTypes.js

require('dotenv').config();
const mongoose = require('mongoose');
const RoomType = require('../models/RoomType');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://matiasgonard1_db_user:RHSQQGbznTlVsbOC@pms2.pcm2o1i.mongodb.net/crm_hotelero?retryWrites=true&w=majority&appName=pms2';

const ROOM_TYPES_DATA = [
  {
    name: 'doble',
    basePrice: 8500,
    currency: 'ARS',
    capacity: 2,
    description: 'Habitación doble con cama matrimonial o dos camas',
    amenities: ['Wi-Fi', 'TV', 'Baño privado', 'Aire acondicionado'],
    isActive: true
  },
  {
    name: 'triple',
    basePrice: 11500,
    currency: 'ARS',
    capacity: 3,
    description: 'Habitación triple con tres camas individuales',
    amenities: ['Wi-Fi', 'TV', 'Baño privado', 'Aire acondicionado'],
    isActive: true
  },
  {
    name: 'cuadruple',
    basePrice: 15000,
    currency: 'ARS',
    capacity: 4,
    description: 'Habitación cuádruple para hasta 4 personas',
    amenities: ['Wi-Fi', 'TV', 'Baño privado', 'Aire acondicionado', 'Minibar'],
    isActive: true
  }
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB');

  let created = 0;
  let skipped = 0;

  for (const data of ROOM_TYPES_DATA) {
    const existing = await RoomType.findOne({ name: data.name });
    if (existing) {
      console.log(`  ↷ RoomType '${data.name}' ya existe (id: ${existing._id}) — omitido`);
      skipped++;
    } else {
      const rt = await RoomType.create(data);
      console.log(`  ✅ RoomType '${data.name}' creado (id: ${rt._id}) → $${data.basePrice} ARS/noche`);
      created++;
    }
  }

  console.log(`\nSeed completo: ${created} creados, ${skipped} omitidos.`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Error en seed de RoomTypes:', err);
  process.exit(1);
});
