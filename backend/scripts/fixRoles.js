// scripts/fixRoles.js - Corrige roles de usuarios de prueba
require('dotenv').config({ path: './config/.env' });
const mongoose = require('mongoose');

async function fixRoles() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pms');
  const col = mongoose.connection.db.collection('users');

  await col.updateOne({ email: 'admin@hotelcrm.com' }, { $set: { role: 'admin' } });
  await col.updateOne({ email: 'recepcion@hotelcrm.com' }, { $set: { role: 'recepcionista' } });

  const users = await col.find({}, { projection: { name: 1, email: 1, role: 1 } }).toArray();
  console.log('\nUSUARIOS EN DB:');
  users.forEach(u => console.log(` - ${u.role.padEnd(14)} ${u.email}`));
  console.log('\n✅ Roles corregidos.');
  process.exit(0);
}

fixRoles().catch(e => { console.error(e); process.exit(1); });
