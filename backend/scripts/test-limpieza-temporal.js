// scripts/test-limpieza-temporal.js
// Script para probar que limpieza solo afecta el día actual

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/Room');

const testLimpieza = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero');
    console.log('✅ Conectado a MongoDB');

    // Simular endpoint de status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Generar rango de fechas (3 días: ayer, hoy, mañana)
    const dateRange = [];
    for (let i = -1; i <= 1; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dateRange.push(date.toISOString().split('T')[0]);
    }

    console.log('\n📅 Rango de fechas a probar:', dateRange);
    console.log(`   Hoy es: ${today.toISOString().split('T')[0]}`);

    // Buscar habitación 107
    const room107 = await Room.findOne({ number: 107 });
    if (!room107) {
      console.log('❌ Habitación 107 no encontrada');
      return;
    }

    console.log(`\n🏨 Habitación 107 estado: ${room107.status}`);

    // Simular la lógica del calendario
    const calendar = {};
    dateRange.forEach(date => {
      const currentDate = new Date(date);
      currentDate.setHours(0, 0, 0, 0);
      
      console.log(`\n🔍 Evaluando fecha: ${date}`);
      
      // Lógica exacta del controller
      if (room107.status === 'mantenimiento') {
        calendar[date] = 'mantenimiento';
        console.log(`   🔧 MANTENIMIENTO`);
      } else if (room107.status === 'limpieza' && currentDate.getTime() === today.getTime()) {
        calendar[date] = 'limpieza';
        console.log(`   🧹 LIMPIEZA (solo hoy)`);
      } else if (room107.status === 'limpieza' && currentDate.getTime() !== today.getTime()) {
        calendar[date] = 'disponible';
        console.log(`   ✨ Disponible (limpieza no afecta otros días)`);
      } else {
        calendar[date] = 'disponible';
        console.log(`   ✅ Disponible`);
      }
    });

    console.log('\n📊 RESULTADO FINAL:');
    Object.entries(calendar).forEach(([date, status]) => {
      const emoji = status === 'limpieza' ? '🧹' : 
                   status === 'mantenimiento' ? '🔧' : '✅';
      console.log(`   ${date}: ${emoji} ${status.toUpperCase()}`);
    });

    // Verificar la lógica esperada
    const expectedResults = {
      [dateRange[0]]: 'disponible', // ayer
      [dateRange[1]]: room107.status === 'limpieza' ? 'limpieza' : 'disponible', // hoy
      [dateRange[2]]: 'disponible'  // mañana
    };

    console.log('\n🎯 VERIFICACIÓN:');
    let allCorrect = true;
    Object.entries(expectedResults).forEach(([date, expected]) => {
      const actual = calendar[date];
      const isCorrect = actual === expected;
      const emoji = isCorrect ? '✅' : '❌';
      console.log(`   ${date}: ${emoji} Esperado: ${expected}, Actual: ${actual}`);
      if (!isCorrect) allCorrect = false;
    });

    if (allCorrect) {
      console.log('\n🎉 SUCCESS: La lógica funciona correctamente');
      console.log('   - Limpieza solo afecta el día actual');
      console.log('   - Otros días aparecen como disponibles');
    } else {
      console.log('\n❌ ERROR: La lógica no funciona como esperado');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔚 Desconectado de MongoDB');
  }
};

// Ejecutar test
testLimpieza();