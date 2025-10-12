// scripts/migrate-reservation-client-unification.js
// Script para migrar reservas y unificar User/Client

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Client = require('../models/Client');
const User = require('../models/User');

// Configuración de MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function migrateReservations() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // 1. Encontrar reservas que tienen name/email pero no client
    const reservationsWithoutClient = await Reservation.find({
      client: { $exists: false },
      $or: [
        { name: { $exists: true, $ne: null } },
        { email: { $exists: true, $ne: null } }
      ]
    });

    console.log(`\n📋 Encontradas ${reservationsWithoutClient.length} reservas sin client`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const reservation of reservationsWithoutClient) {
      try {
        console.log(`\n🔄 Procesando reserva ${reservation._id}`);
        
        // Datos de la reserva
        const reservationName = reservation.name || 'Cliente';
        const reservationEmail = reservation.email || `cliente_${reservation._id}@temp.com`;
        
        // Buscar si ya existe un cliente con este email
        let client = await Client.findOne({ email: reservationEmail });
        
        if (!client) {
          // Crear nuevo cliente
          const nameParts = reservationName.split(' ');
          const nombre = nameParts[0] || 'Cliente';
          const apellido = nameParts.slice(1).join(' ') || 'Temp';
          
          client = new Client({
            nombre,
            apellido,
            email: reservationEmail,
            dni: `TEMP_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // DNI temporal único
            whatsapp: '+000000000' // WhatsApp temporal
          });
          
          await client.save();
          console.log(`   ✅ Cliente creado: ${client.fullName} (${client.email})`);
        } else {
          console.log(`   📍 Cliente existente encontrado: ${client.fullName}`);
        }
        
        // Asignar cliente a la reserva
        reservation.client = client._id;
        
        // Limpiar campos obsoletos (si existen)
        reservation.name = undefined;
        reservation.email = undefined;
        
        await reservation.save();
        console.log(`   ✅ Reserva migrada correctamente`);
        migratedCount++;
        
      } catch (error) {
        console.error(`   ❌ Error migrando reserva ${reservation._id}:`, error.message);
        errorCount++;
      }
    }

    // 2. Verificar reservas huérfanas (sin client válido)
    const orphanReservations = await Reservation.find({
      $or: [
        { client: { $exists: false } },
        { client: null }
      ]
    });

    console.log(`\n🔍 Verificación: ${orphanReservations.length} reservas huérfanas encontradas`);

    // 3. Estadísticas finales
    const totalReservations = await Reservation.countDocuments();
    const reservationsWithClient = await Reservation.countDocuments({ client: { $exists: true, $ne: null } });
    const totalClients = await Client.countDocuments();

    console.log('\n📊 ESTADÍSTICAS FINALES:');
    console.log(`   📋 Total reservas: ${totalReservations}`);
    console.log(`   ✅ Reservas con cliente: ${reservationsWithClient}`);
    console.log(`   👥 Total clientes: ${totalClients}`);
    console.log(`   🔄 Reservas migradas: ${migratedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

    if (migratedCount > 0) {
      console.log('\n🎉 ¡Migración completada exitosamente!');
    } else {
      console.log('\n✨ No se requería migración');
    }

  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Desconectado de MongoDB');
  }
}

// Función para verificar el estado actual
async function checkCurrentState() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB para verificación');

    const reservationsWithName = await Reservation.countDocuments({ name: { $exists: true } });
    const reservationsWithEmail = await Reservation.countDocuments({ email: { $exists: true } });
    const reservationsWithClient = await Reservation.countDocuments({ client: { $exists: true, $ne: null } });
    const totalReservations = await Reservation.countDocuments();

    console.log('\n📊 ESTADO ACTUAL:');
    console.log(`   📋 Total reservas: ${totalReservations}`);
    console.log(`   📝 Reservas con campo "name": ${reservationsWithName}`);
    console.log(`   📧 Reservas con campo "email": ${reservationsWithEmail}`);
    console.log(`   👥 Reservas con client asignado: ${reservationsWithClient}`);

    if (reservationsWithName > 0 || reservationsWithEmail > 0) {
      console.log('\n⚠️ Se requiere migración');
    } else {
      console.log('\n✅ Datos ya migrados o consistentes');
    }

  } catch (error) {
    console.error('❌ Error verificando estado:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Ejecutar según el argumento
const command = process.argv[2];

if (command === 'check') {
  checkCurrentState();
} else if (command === 'migrate') {
  migrateReservations();
} else {
  console.log('💡 Uso:');
  console.log('   node migrate-reservation-client-unification.js check    # Verificar estado');
  console.log('   node migrate-reservation-client-unification.js migrate  # Ejecutar migración');
}