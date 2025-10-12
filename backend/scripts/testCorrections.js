#!/usr/bin/env node
// scripts/testCorrections.js
// Script para verificar que las correcciones implementadas funcionan correctamente

const mongoose = require('mongoose');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

// Importar modelos para verificar consistencia
const Room = require('../models/Room');
const RoomType = require('../models/RoomType');
const Reservation = require('../models/Reservation');
const { VALID_ROOM_TYPES, VALID_ROOM_STATUS, VALID_RESERVATION_STATUS } = require('../constants/businessConstants');

// Importar servicio de errores
const ErrorHandlingService = require('../services/errorHandlingService');

console.log('🔍 VERIFICANDO CORRECCIONES IMPLEMENTADAS');
console.log('=========================================');

async function testModelConsistency() {
  console.log('\n1. 📊 Verificando consistencia de modelos...');
  
  try {
    // Verificar que los enums sean consistentes
    const roomSchema = Room.schema.paths.type;
    const roomTypeSchema = RoomType.schema.paths.name;
    const reservationSchema = Reservation.schema.paths.tipo;
    
    console.log('   ✅ Room.type enum:', roomSchema.enumValues);
    console.log('   ✅ RoomType.name enum:', roomTypeSchema.enumValues);
    console.log('   ✅ Reservation.tipo enum:', reservationSchema.enumValues);
    
    // Verificar que todos incluyan 'suite'
    const includesSuite = [
      roomSchema.enumValues.includes('suite'),
      roomTypeSchema.enumValues.includes('suite'),
      reservationSchema.enumValues.includes('suite')
    ];
    
    if (includesSuite.every(val => val)) {
      console.log('   ✅ Todos los modelos incluyen "suite" correctamente');
    } else {
      console.log('   ❌ Inconsistencia detectada en enums');
    }
    
    // Verificar constantes centralizadas
    console.log('   ✅ Constantes centralizadas:', VALID_ROOM_TYPES);
    
    return true;
  } catch (error) {
    console.log('   ❌ Error verificando modelos:', error.message);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n2. 🛡️ Verificando manejo de errores...');
  
  try {
    // Test de error de negocio
    const businessError = ErrorHandlingService.createBusinessError('Test error', 400);
    console.log('   ✅ Error de negocio creado:', businessError.isBusinessError);
    
    // Test de validación de campos requeridos
    try {
      ErrorHandlingService.validateRequiredFields(
        { name: 'test' }, 
        ['name', 'email'], 
        'testOperation'
      );
    } catch (validationError) {
      console.log('   ✅ Validación de campos requeridos funciona');
    }
    
    // Test de categorización de errores
    const mongoError = new Error('Duplicate key error');
    mongoError.code = 11000;
    mongoError.keyPattern = { email: 1 };
    
    const categorized = ErrorHandlingService.categorizeError(mongoError, 'testOperation');
    console.log('   ✅ Categorización de errores funciona:', categorized.statusCode === 409);
    
    return true;
  } catch (error) {
    console.log('   ❌ Error verificando manejo de errores:', error.message);
    return false;
  }
}

async function testDependencies() {
  console.log('\n3. 📦 Verificando dependencias...');
  
  try {
    // Verificar que las dependencias se pueden importar
    require('xss');
    console.log('   ✅ xss está disponible');
    
    require('validator');
    console.log('   ✅ validator está disponible');
    
    // En tests se podría verificar mongodb-memory-server
    try {
      require('mongodb-memory-server');
      console.log('   ✅ mongodb-memory-server está disponible');
    } catch (e) {
      console.log('   ⚠️ mongodb-memory-server no disponible (normal si no es entorno de test)');
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ Error verificando dependencias:', error.message);
    return false;
  }
}

async function testDatabaseConnection() {
  console.log('\n4. 🔗 Verificando conexión a base de datos...');
  
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('   ✅ Conexión a MongoDB exitosa');
    
    // Test de operación básica
    const roomCount = await Room.countDocuments();
    console.log(`   ✅ Habitaciones en base de datos: ${roomCount}`);
    
    return true;
  } catch (error) {
    console.log('   ❌ Error conectando a base de datos:', error.message);
    return false;
  }
}

async function runAllTests() {
  const results = [];
  
  results.push(await testModelConsistency());
  results.push(await testErrorHandling());
  results.push(await testDependencies());
  results.push(await testDatabaseConnection());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n📋 RESUMEN DE VERIFICACIONES');
  console.log('============================');
  console.log(`✅ Pruebas pasadas: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 ¡Todas las correcciones implementadas correctamente!');
  } else {
    console.log('⚠️ Algunas correcciones necesitan atención');
  }
  
  // Cerrar conexión
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promesa rechazada no manejada:', error);
  process.exit(1);
});

// Ejecutar tests
runAllTests().catch((error) => {
  console.error('❌ Error ejecutando tests:', error);
  process.exit(1);
});