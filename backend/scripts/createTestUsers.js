// scripts/createTestUsers.js
// Script para crear usuarios de prueba con el nuevo sistema de autenticación

const mongoose = require('mongoose');
const authService = require('../services/authService');
require('dotenv').config({ path: './config/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

async function createTestUsers() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado a MongoDB');

    // Crear usuario administrador
    console.log('\n👤 Creando usuario administrador...');
    const adminResult = await authService.register({
      name: 'Administrador Sistema',
      email: 'admin@hotelcrm.com',
      password: 'admin123',
      role: 'admin'
    });

    if (adminResult.success) {
      console.log('✅ Usuario administrador creado:');
      console.log(`   Email: admin@hotelcrm.com`);
      console.log(`   Password: admin123`);
      console.log(`   Rol: ${adminResult.user.role}`);
    } else {
      console.log(`❌ Error creando administrador: ${adminResult.message}`);
    }

    // Crear usuario recepcionista
    console.log('\n👤 Creando usuario recepcionista...');
    const receptionResult = await authService.register({
      name: 'Recepcionista Hotel',
      email: 'recepcion@hotelcrm.com',
      password: 'recepcion123',
      role: 'recepcionista'
    });

    if (receptionResult.success) {
      console.log('✅ Usuario recepcionista creado:');
      console.log(`   Email: recepcion@hotelcrm.com`);
      console.log(`   Password: recepcion123`);
      console.log(`   Rol: ${receptionResult.user.role}`);
    } else {
      console.log(`❌ Error creando recepcionista: ${receptionResult.message}`);
    }

    // Crear usuario cliente
    console.log('\n👤 Creando usuario cliente...');
    const clientResult = await authService.register({
      name: 'Cliente Prueba',
      email: 'cliente@hotelcrm.com',
      password: 'cliente123',
      role: 'cliente'
    });

    if (clientResult.success) {
      console.log('✅ Usuario cliente creado:');
      console.log(`   Email: cliente@hotelcrm.com`);
      console.log(`   Password: cliente123`);
      console.log(`   Rol: ${clientResult.user.role}`);
    } else {
      console.log(`❌ Error creando cliente: ${clientResult.message}`);
    }

    console.log('\n🎉 ¡Usuarios de prueba creados exitosamente!');
    console.log('\n📝 Credenciales de acceso:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ ADMINISTRADOR                                           │');
    console.log('│ Email: admin@hotelcrm.com                              │');
    console.log('│ Password: admin123                                      │');
    console.log('│ URL: http://localhost:3000/admin                       │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ RECEPCIONISTA                                           │');
    console.log('│ Email: recepcion@hotelcrm.com                          │');
    console.log('│ Password: recepcion123                                  │');
    console.log('│ URL: http://localhost:3000/recepcion                   │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ CLIENTE                                                 │');
    console.log('│ Email: cliente@hotelcrm.com                            │');
    console.log('│ Password: cliente123                                    │');
    console.log('│ URL: http://localhost:3000/                            │');
    console.log('└─────────────────────────────────────────────────────────┘');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  createTestUsers();
}

module.exports = { createTestUsers };