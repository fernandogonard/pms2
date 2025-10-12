// scripts/fixReservationRoomStates.js
// Script para corregir inconsistencias entre habitaciones y reservas

const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const { ROOM_STATUS, RESERVATION_STATUS } = require('../constants/businessConstants');

// Configuración de la base de datos
const DB_URL = 'mongodb://localhost:27017/hotelcrm';

// Función principal para corregir las inconsistencias
async function fixReservationRoomStates() {
  try {
    console.log('🏨 Conectando a la base de datos...');
    await mongoose.connect(DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a MongoDB');

    console.log('\n🔍 Analizando habitaciones y reservas...');
    
    // PASO 1: Obtener todas las habitaciones y reservas activas
    const rooms = await Room.find().sort({ number: 1 });
    console.log(`📊 Total de habitaciones: ${rooms.length}`);
    
    const activeReservations = await Reservation.find({
      status: { $in: ['reservada', 'checkin'] }
    }).populate('room');
    console.log(`📋 Total de reservas activas: ${activeReservations.length}`);

    // PASO 2: Analizar la situación actual
    const roomsByStatus = {};
    rooms.forEach(room => {
      if (!roomsByStatus[room.status]) {
        roomsByStatus[room.status] = [];
      }
      roomsByStatus[room.status].push(room);
    });

    console.log('\n📈 Distribución actual de habitaciones por estado:');
    Object.keys(roomsByStatus).forEach(status => {
      console.log(`   ${status}: ${roomsByStatus[status].length} habitaciones`);
    });

    const reservationsByStatus = {};
    activeReservations.forEach(res => {
      if (!reservationsByStatus[res.status]) {
        reservationsByStatus[res.status] = [];
      }
      reservationsByStatus[res.status].push(res);
    });

    console.log('\n📈 Distribución de reservas activas por estado:');
    Object.keys(reservationsByStatus).forEach(status => {
      console.log(`   ${status}: ${reservationsByStatus[status].length} reservas`);
    });

    // PASO 3: Identificar habitaciones asignadas a reservas
    const assignedRooms = new Set();
    const roomsWithActiveCheckins = new Set();
    
    activeReservations.forEach(res => {
      if (res.room && res.room.length > 0) {
        res.room.forEach(room => {
          assignedRooms.add(room._id.toString());
          if (res.status === 'checkin') {
            roomsWithActiveCheckins.add(room._id.toString());
          }
        });
      }
    });

    console.log(`\n🏠 Habitaciones asignadas a reservas: ${assignedRooms.size}`);
    console.log(`🏠 Habitaciones con check-ins activos: ${roomsWithActiveCheckins.size}`);

    // PASO 4: Identificar inconsistencias
    const inconsistentRooms = [];

    rooms.forEach(room => {
      const roomId = room._id.toString();
      const hasActiveCheckin = roomsWithActiveCheckins.has(roomId);
      
      // Caso 1: Habitación con check-in pero no está marcada como ocupada
      if (hasActiveCheckin && room.status !== ROOM_STATUS.OCUPADA) {
        inconsistentRooms.push({
          room,
          issue: 'Habitación con check-in activo pero estado no es "ocupada"',
          currentStatus: room.status,
          correctStatus: ROOM_STATUS.OCUPADA
        });
      }
      
      // Caso 2: Habitación marcada como ocupada pero sin check-in activo
      else if (room.status === ROOM_STATUS.OCUPADA && !hasActiveCheckin) {
        inconsistentRooms.push({
          room,
          issue: 'Habitación marcada como ocupada pero sin check-in activo',
          currentStatus: room.status,
          correctStatus: ROOM_STATUS.DISPONIBLE
        });
      }
    });

    console.log(`\n⚠️ Habitaciones con estados inconsistentes: ${inconsistentRooms.length}`);
    
    // PASO 5: Mostrar problemas encontrados
    if (inconsistentRooms.length > 0) {
      console.log('\n🔴 Problemas detectados:');
      inconsistentRooms.forEach((item, i) => {
        console.log(`   ${i+1}. Habitación #${item.room.number}: ${item.issue}`);
        console.log(`      Estado actual: ${item.currentStatus}, Estado correcto: ${item.correctStatus}`);
      });
      
      // PASO 6: Corregir inconsistencias
      console.log('\n⚙️ Corrigiendo estados inconsistentes...');
      
      let corrected = 0;
      for (const item of inconsistentRooms) {
        item.room.status = item.correctStatus;
        await item.room.save();
        corrected++;
        console.log(`   ✅ Habitación #${item.room.number} actualizada a estado "${item.correctStatus}"`);
      }
      
      console.log(`\n🎉 Corrección completada: ${corrected} habitaciones actualizadas`);
    } else {
      console.log('\n✅ No se encontraron inconsistencias entre habitaciones y reservas');
    }

    // PASO 7: Verificar habitaciones sin asignar en reservas con check-in
    const checkinReservationsWithoutRooms = activeReservations.filter(
      res => res.status === 'checkin' && (!res.room || res.room.length === 0)
    );

    if (checkinReservationsWithoutRooms.length > 0) {
      console.log(`\n⚠️ Se encontraron ${checkinReservationsWithoutRooms.length} reservas con check-in pero sin habitaciones asignadas:`);
      checkinReservationsWithoutRooms.forEach((res, i) => {
        console.log(`   ${i+1}. Reserva ID: ${res._id}, Cliente: ${res.getClientFullName()}, Check-in: ${res.checkIn.toISOString().split('T')[0]}`);
      });
      
      // Aquí podrías implementar lógica para asignar habitaciones automáticamente
      console.log('\n⚠️ Se recomienda asignar habitaciones manualmente a estas reservas desde el panel de administración');
    }

    // Estadísticas finales
    const updatedRooms = await Room.find();
    const updatedRoomsByStatus = {};
    
    updatedRooms.forEach(room => {
      if (!updatedRoomsByStatus[room.status]) {
        updatedRoomsByStatus[room.status] = [];
      }
      updatedRoomsByStatus[room.status].push(room);
    });
    
    console.log('\n📊 Estado final de habitaciones:');
    Object.keys(updatedRoomsByStatus).forEach(status => {
      console.log(`   ${status}: ${updatedRoomsByStatus[status].length} habitaciones`);
    });

  } catch (error) {
    console.error('❌ Error en el proceso:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
  console.log('🚀 Iniciando script para corregir inconsistencias entre habitaciones y reservas...\n');
  fixReservationRoomStates();
}

module.exports = { fixReservationRoomStates };