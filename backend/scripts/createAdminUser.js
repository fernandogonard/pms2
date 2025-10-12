// scripts/createAdminUser.js
// Script para crear un usuario admin de prueba en MongoDB

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

async function createAdmin() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const email = 'admin@hotel.com';
  const password = await bcrypt.hash('admin123', 10);
  const exists = await User.findOne({ email });
  if (exists) {
    console.log('El usuario admin ya existe.');
    process.exit(0);
  }
  const user = new User({ name: 'Admin', email, password, role: 'admin' });
  await user.save();
  console.log('Usuario admin creado:');
  console.log('Email: admin@hotel.com');
  console.log('Password: admin123');
  process.exit(0);
}

createAdmin();
