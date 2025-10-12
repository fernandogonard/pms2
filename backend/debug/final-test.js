// debug/final-test.js
// Script final para probar todas las funcionalidades del sistema

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Client = require('../models/Client');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-crm');
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function testReservationSystem() {
  console.log('\n🧪 PROBANDO SISTEMA DE RESERVAS');
  console.log('='.repeat(60));
  
  // 1. Verificar estado actual
  const rooms = await Room.find().sort({ number: 1 });     
  const reservations = await Reservation.find().populate('room client').sort({ checkIn: 1 });
  
  console.log(`📊 Estado actual:`);
  console.log(`   🏠 Habitaciones: ${rooms.length}`);
  console.log(`   📅 Reservas: ${reservations.length}`);
  
  // 2. Mostrar detalles de las reservas
  console.log('\n📋 RESERVAS ACTUALES:');
  reservations.forEach((res, index) => {
    console.log(`   ${index + 1}. ${res._id} - ${res.tipo} x${res.cantidad || 1}`);
    console.log(`      Cliente: ${res.client ? `${res.client.nombre} ${res.client.apellido}` : 'Sin cliente'}`);
    console.log(`      Fechas: ${res.checkIn.toISOString().split('T')[0]} - ${res.checkOut.toISOString().split('T')[0]}`);
    console.log(`      Status: ${res.status}`);
    
    if (res.room && res.room.length > 0) {
      console.log(`      🏠 Habitaciones: ${res.room.map(r => r.number).join(', ')}`);
    } else {
      console.log(`      🟡 VIRTUAL (sin habitaciones asignadas)`);
    }
  });
  
  // 3. Probar asignación de habitación a reserva virtual
  if (reservations.length > 0) {
    const virtualReservation = reservations.find(r => !r.room || r.room.length === 0);
    
    if (virtualReservation) {
      console.log(`\n🔧 PROBANDO ASIGNACIÓN AUTOMÁTICA:`);
      console.log(`   Reserva virtual: ${virtualReservation._id} (${virtualReservation.tipo})`);
      
      // Buscar habitación disponible del tipo correcto
      const availableRoom = rooms.find(r => 
        r.type === virtualReservation.tipo && 
        r.status === 'disponible'
      );
      
      if (availableRoom) {
        console.log(`   ✅ Habitación disponible encontrada: ${availableRoom.number}`);
        
        // Simular asignación
        virtualReservation.room = [availableRoom._id];
        availableRoom.status = 'ocupada';
        
        await virtualReservation.save();
        await availableRoom.save();
        
        console.log(`   ✅ Asignación completada: ${availableRoom.number} → Reserva ${virtualReservation._id}`);
        
        // Probar desasignación
        console.log(`\n🔧 PROBANDO DESASIGNACIÓN:`);
        virtualReservation.room = [];
        availableRoom.status = 'disponible';
        
        await virtualReservation.save();
        await availableRoom.save();
        
        console.log(`   ✅ Desasignación completada: ${availableRoom.number} liberada`);
      } else {
        console.log(`   ⚠️ No hay habitaciones ${virtualReservation.tipo} disponibles`);
      }
    } else {
      console.log(`\n   ℹ️ No hay reservas virtuales para probar asignación`);
    }
  }
  
  // 4. Simular cálculo de disponibilidad
  console.log(`\n🔍 PROBANDO CÁLCULO DE DISPONIBILIDAD:`);
  
  const fechaTest = new Date('2025-10-10');
  const fechaTestStr = fechaTest.toISOString().split('T')[0];
  
  console.log(`   Fecha de prueba: ${fechaTestStr}`);
  
  // Agrupar habitaciones por tipo
  const roomsByType = {};
  rooms.forEach(room => {
    if (!roomsByType[room.type]) roomsByType[room.type] = [];
    roomsByType[room.type].push(room);
  });
  
  Object.keys(roomsByType).forEach(tipo => {
    const tipoRooms = roomsByType[tipo];
    const totalRooms = tipoRooms.length;
    
    // Contar habitaciones ocupadas en la fecha
    const ocupadasReales = tipoRooms.filter(room => room.status === 'ocupada').length;
    const enMantenimiento = tipoRooms.filter(room => ['mantenimiento', 'limpieza'].includes(room.status)).length;
    
    // Contar reservas virtuales para esta fecha y tipo
    const reservasVirtuales = reservations.filter(res => {
      if (res.room && res.room.length > 0) return false; // no es virtual
      if (res.tipo !== tipo) return false; // tipo diferente
      
      const checkIn = new Date(res.checkIn);
      const checkOut = new Date(res.checkOut);
      
      return fechaTest >= checkIn && fechaTest < checkOut;
    });
    
    const virtualCount = reservasVirtuales.reduce((sum, res) => sum + (res.cantidad || 1), 0);
    
    const disponibles = totalRooms - ocupadasReales - enMantenimiento - virtualCount;
    
    console.log(`   ${tipo}: ${totalRooms} total, ${ocupadasReales} ocupadas, ${enMantenimiento} mantenimiento, ${virtualCount} virtuales → ${Math.max(0, disponibles)} disponibles`);
    
    if (disponibles < 0) {
      console.log(`     ⚠️ SOBREVENTA DETECTADA: ${Math.abs(disponibles)} habitaciones`);
    }
  });
}

async function testValidation() {
  console.log('\n🔍 PROBANDO VALIDACIONES:');
  console.log('='.repeat(60));
  
  // Intentar crear una reserva que causaría sobreventa
  const clients = await Client.find();
  if (clients.length === 0) {
    console.log('   ⚠️ No hay clientes para probar');
    return;
  }
  
  try {
    // Intentar reservar más habitaciones dobles de las que existen
    const roomCount = await Room.countDocuments({ type: 'doble', status: 'disponible' });
    console.log(`   Habitaciones dobles disponibles: ${roomCount}`);
    
    if (roomCount > 0) {
      const testReservation = new Reservation({
        tipo: 'doble',
        cantidad: roomCount + 1, // Más de las disponibles
        checkIn: '2025-10-15',
        checkOut: '2025-10-18',
        client: clients[0]._id,
        status: 'reservada'
      });
      
      console.log(`   Intentando crear reserva para ${roomCount + 1} habitaciones dobles...`);
      
      // Esta debería fallar con la nueva validación
      await testReservation.save();
      console.log(`   ❌ PROBLEMA: Se permitió crear sobreventa!`);
      
      // Limpiar
      await testReservation.deleteOne();
    }
  } catch (error) {
    console.log(`   ✅ Validación funcionando: ${error.message}`);
  }
}

async function main() {
  await connectDB();
  
  try {
    await testReservationSystem();
    await testValidation();
    
    console.log('\n✅ PRUEBAS COMPLETADAS');
    console.log('='.repeat(60));
    console.log('🔧 ENDPOINT AGREGADO: PUT /api/reservations/:id/unassign-rooms');
    console.log('   - Permite desasignar habitaciones específicas o todas');
    console.log('   - Actualiza estado de habitaciones a "disponible"');
    console.log('   - Convierte reserva a virtual si no quedan habitaciones');
    console.log('   - Requiere rol admin o recepcionista');
    
  } catch (error) {
    console.error('❌ Error en pruebas:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  }
}

main();