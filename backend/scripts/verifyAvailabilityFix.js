// scripts/verifyAvailabilityFix.js
// Script para auditar el problema de disponibilidad de habitaciones

const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const DB_URL = 'mongodb://localhost:27017/crm-hotelero';

async function verifyFix() {
  try {
    console.log('🔍 AUDITANDO PROBLEMA DE DISPONIBILIDAD...\n');
    
    await mongoose.connect(DB_URL);
    console.log('✅ Conectado a MongoDB');

    const checkInDate = new Date('2025-10-06');
    const checkOutDate = new Date('2025-10-07');
    const type = 'doble';
    const cantidadSolicitada = 3;

    console.log(`\n📋 PARÁMETROS DE LA CONSULTA:`);
    console.log(`   Tipo: ${type}`);
    console.log(`   Check-in: ${checkInDate.toISOString().split('T')[0]}`);
    console.log(`   Check-out: ${checkOutDate.toISOString().split('T')[0]}`);
    console.log(`   Cantidad solicitada: ${cantidadSolicitada}`);

    // PASO 1: Contar habitaciones totales del tipo
    const totalRooms = await Room.find({ type }).lean();
    console.log(`\n🏨 PASO 1 - HABITACIONES ${type.toUpperCase()} TOTALES: ${totalRooms.length}`);
    totalRooms.forEach(room => {
      console.log(`   #${room.number} - Piso ${room.floor} - Estado: ${room.status}`);
    });

    if (totalRooms.length === 0) {
      console.log('❌ PROBLEMA CRÍTICO: No hay habitaciones del tipo solicitado en la BD');
      return;
    }

    // PASO 2: Buscar reservas que se solapan
    console.log(`\n📅 PASO 2 - BUSCANDO RESERVAS SOLAPANTES...`);
    console.log(`   Condiciones:`);
    console.log(`   - Status: reservada o checkin`);
    console.log(`   - Check-in < ${checkOutDate.toISOString().split('T')[0]}`);
    console.log(`   - Check-out > ${checkInDate.toISOString().split('T')[0]}`);

    const overlappingReservations = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] },
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate }
    }).populate('room').lean();

    console.log(`\n   Reservas encontradas: ${overlappingReservations.length}`);

    // PASO 3: Procesar reservas una por una
    console.log(`\n🔍 PASO 3 - PROCESANDO RESERVAS:`);
    
    const occupiedRoomIds = new Set();
    let virtualReservationsCount = 0;

    overlappingReservations.forEach((reservation, index) => {
      console.log(`\n   Reserva ${index + 1}:`);
      console.log(`     ID: ${reservation._id}`);
      console.log(`     Tipo: ${reservation.tipo}`);
      console.log(`     Cantidad: ${reservation.cantidad}`);
      console.log(`     Estado: ${reservation.status}`);
      console.log(`     Check-in: ${reservation.checkIn.toISOString().split('T')[0]}`);
      console.log(`     Check-out: ${reservation.checkOut.toISOString().split('T')[0]}`);
      console.log(`     Habitaciones asignadas: ${reservation.room?.length || 0}`);
      
      if (reservation.room && reservation.room.length > 0) {
        console.log(`     Habitaciones: ${reservation.room.map(r => `#${r.number}`).join(', ')}`);
        reservation.room.forEach(roomObj => {
          occupiedRoomIds.add(roomObj._id.toString());
        });
        console.log(`     ✅ Reserva REAL con habitaciones asignadas`);
      } else if (reservation.tipo === type) {
        virtualReservationsCount += reservation.cantidad || 1;
        console.log(`     👻 Reserva VIRTUAL del tipo ${type} (+${reservation.cantidad || 1})`);
      } else {
        console.log(`     ⚪ Reserva de otro tipo (${reservation.tipo}) - ignorada`);
      }
    });

    console.log(`\n📊 PASO 4 - RESUMEN DE OCUPACIÓN:`);
    console.log(`   Habitaciones ocupadas por reservas reales: ${occupiedRoomIds.size}`);
    console.log(`   Reservas virtuales del tipo ${type}: ${virtualReservationsCount}`);

    // PASO 5: Calcular habitaciones físicamente disponibles
    console.log(`\n✅ PASO 5 - CALCULANDO DISPONIBILIDAD FÍSICA:`);
    
    const availableRooms = totalRooms.filter(room => {
      if (room.status === 'mantenimiento') {
        console.log(`   ⚠️  #${room.number} - Excluida por mantenimiento`);
        return false;
      }
      if (occupiedRoomIds.has(room._id.toString())) {
        console.log(`   🔒 #${room.number} - Excluida por reserva real`);
        return false;
      }
      console.log(`   ✅ #${room.number} - Disponible`);
      return true;
    });

    const physicallyAvailable = availableRooms.length;
    const reallyAvailable = Math.max(0, physicallyAvailable - virtualReservationsCount);

    console.log(`\n🧮 PASO 6 - CÁLCULO FINAL:`);
    console.log(`   Total habitaciones ${type}: ${totalRooms.length}`);
    console.log(`   Físicamente disponibles: ${physicallyAvailable}`);
    console.log(`   Reservas virtuales: ${virtualReservationsCount}`);
    console.log(`   REALMENTE DISPONIBLES: ${reallyAvailable}`);

    // PASO 7: Validar resultado
    console.log(`\n🎯 PASO 7 - VALIDACIÓN:`);
    console.log(`   Solicitadas: ${cantidadSolicitada}`);
    console.log(`   Disponibles: ${reallyAvailable}`);

    if (reallyAvailable >= cantidadSolicitada) {
      console.log(`   ✅ RESULTADO: DEBE PERMITIR LA RESERVA`);
      console.log(`   🎉 Hay suficientes habitaciones (${reallyAvailable} >= ${cantidadSolicitada})`);
    } else {
      console.log(`   ❌ RESULTADO: DEBE RECHAZAR LA RESERVA`);
      console.log(`   ⚠️  Insuficientes habitaciones (${reallyAvailable} < ${cantidadSolicitada})`);
      
      console.log(`\n🔍 DIAGNÓSTICO DEL PROBLEMA:`);
      if (totalRooms.length < cantidadSolicitada) {
        console.log(`   - Inventario insuficiente: Solo ${totalRooms.length} habitaciones ${type} en total`);
      }
      if (occupiedRoomIds.size > 0) {
        console.log(`   - ${occupiedRoomIds.size} habitaciones ocupadas por reservas reales`);
      }
      if (virtualReservationsCount > 0) {
        console.log(`   - ${virtualReservationsCount} habitaciones bloqueadas por reservas virtuales`);
      }
    }

    // PASO 8: Simular llamada API
    console.log(`\n🌐 PASO 8 - SIMULANDO LLAMADA API:`);
    const apiUrl = `http://localhost:5000/api/rooms/available?type=${type}&checkIn=${checkInDate.toISOString().split('T')[0]}&checkOut=${checkOutDate.toISOString().split('T')[0]}&cantidad=${cantidadSolicitada}`;
    console.log(`   URL: ${apiUrl}`);

  } catch (error) {
    console.error('❌ Error durante la auditoría:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

// Función para verificar el código del controlador
function checkControllerCode() {
  const fs = require('fs');
  const path = require('path');
  
  console.log('\n🔍 VERIFICANDO CÓDIGO DEL CONTROLADOR...\n');
  
  const controllerPath = path.join(__dirname, '../controllers/roomController.js');
  
  try {
    const content = fs.readFileSync(controllerPath, 'utf8');
    
    // Buscar la función getAvailableRooms
    const functionStart = content.indexOf('exports.getAvailableRooms');
    if (functionStart === -1) {
      console.log('❌ Función getAvailableRooms no encontrada');
      return;
    }
    
    const functionEnd = content.indexOf('exports.', functionStart + 1);
    const functionContent = functionEnd === -1 
      ? content.substring(functionStart) 
      : content.substring(functionStart, functionEnd);
    
    console.log('✅ Función getAvailableRooms encontrada');
    
    // Verificar elementos clave de la corrección
    const checks = {
      'Usa logHelpers.room.availabilityCheck': functionContent.includes('logHelpers.room.availabilityCheck'),
      'Busca TODAS las habitaciones': functionContent.includes('Room.find({ type: type') || functionContent.includes('Room.find({ type,'),
      'Maneja reservas virtuales': functionContent.includes('virtualReservationsByType') || functionContent.includes('virtualReservations'),
      'Calcula disponibilidad real': functionContent.includes('reallyAvailable') || functionContent.includes('Math.max'),
      'Filtra por mantenimiento': functionContent.includes('mantenimiento'),
      'Usa logging profesional': functionContent.includes('logger.') || functionContent.includes('logHelpers.'),
      'No usa console.log': !functionContent.includes('console.log(')
    };
    
    console.log('\n📋 VERIFICACIONES DEL CÓDIGO:');
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });
    
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    
    console.log(`\n📊 RESULTADO: ${passedChecks}/${totalChecks} verificaciones pasadas`);
    
    if (passedChecks === totalChecks) {
      console.log('✅ EL CÓDIGO ESTÁ CORRECTAMENTE ACTUALIZADO');
    } else {
      console.log('⚠️  EL CÓDIGO NECESITA ACTUALIZACIONES');
      
      // Mostrar una muestra del código actual
      console.log('\n📄 MUESTRA DEL CÓDIGO ACTUAL:');
      const sample = functionContent.substring(0, 800) + (functionContent.length > 800 ? '...' : '');
      console.log(sample);
    }
    
  } catch (error) {
    console.error('❌ Error leyendo el controlador:', error.message);
  }
}

// Ejecutar según argumentos
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'controller') {
    checkControllerCode();
  } else if (command === 'full') {
    checkControllerCode();
    console.log('\n' + '='.repeat(80) + '\n');
    verifyFix();
  } else {
    verifyFix();
  }
}

module.exports = { verifyFix, checkControllerCode };