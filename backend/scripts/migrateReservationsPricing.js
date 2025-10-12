// scripts/migrateReservationsPricing.js
// Script para migrar reservas existentes agregando información de precios

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const RoomType = require('../models/RoomType');
const Client = require('../models/Client');
const BillingService = require('../services/billingService');

async function migrateReservationsPricing() {
  try {
    console.log('🚀 Iniciando migración de precios en reservas...');
    
    // Buscar reservas sin información de precios
    const reservationsToMigrate = await Reservation.find({
      'pricing.total': { $exists: false }
    }).populate('client', 'nombre apellido email');
    
    console.log(`📊 Encontradas ${reservationsToMigrate.length} reservas para migrar`);
    
    if (reservationsToMigrate.length === 0) {
      console.log('✅ No hay reservas que migrar');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const reservation of reservationsToMigrate) {
      try {
        console.log(`🔄 Migrando reserva ${reservation._id} (${reservation.tipo})...`);
        
        // Calcular precios usando el servicio de facturación
        const pricing = await BillingService.calculateReservationPricing({
          tipo: reservation.tipo,
          cantidad: reservation.cantidad,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut
        });
        
        // Actualizar reserva con información de precios
        reservation.pricing = {
          pricePerNight: pricing.pricePerNight,
          totalNights: pricing.totalNights,
          subtotal: pricing.subtotal,
          taxes: pricing.taxes,
          total: pricing.total,
          currency: pricing.currency
        };
        
        // Inicializar información de pago
        if (!reservation.payment) {
          reservation.payment = {
            status: 'pendiente',
            method: 'efectivo',
            amountPaid: 0
          };
        }
        
        // Inicializar información de factura
        if (!reservation.invoice) {
          reservation.invoice = {
            isPaid: false
          };
        }
        
        await reservation.save();
        migratedCount++;
        
        console.log(`✅ Reserva ${reservation._id} migrada: $${pricing.total} (${pricing.totalNights} noches)`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Error migrando reserva ${reservation._id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log('\n📈 RESUMEN DE MIGRACIÓN:');
    console.log('========================');
    console.log(`✅ Reservas migradas: ${migratedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n🚨 ERRORES ENCONTRADOS:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    // Mostrar estadísticas post-migración
    console.log('\n📊 ESTADÍSTICAS POST-MIGRACIÓN:');
    console.log('===============================');
    
    const totalReservations = await Reservation.countDocuments();
    const reservationsWithPricing = await Reservation.countDocuments({
      'pricing.total': { $exists: true }
    });
    
    console.log(`Total de reservas: ${totalReservations}`);
    console.log(`Reservas con precios: ${reservationsWithPricing}`);
    console.log(`Progreso: ${Math.round((reservationsWithPricing / totalReservations) * 100)}%`);
    
    // Calcular revenue total
    const revenueAggregation = await Reservation.aggregate([
      { $match: { 'pricing.total': { $exists: true } } },
      { $group: { _id: null, totalRevenue: { $sum: '$pricing.total' } } }
    ]);
    
    if (revenueAggregation.length > 0) {
      const totalRevenue = revenueAggregation[0].totalRevenue;
      console.log(`Revenue total: $${totalRevenue.toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  // Conectar a MongoDB si no está conectado
  if (mongoose.connection.readyState === 0) {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-crm';
    mongoose.connect(mongoURI)
      .then(() => {
        console.log('✅ Conectado a MongoDB');
        return migrateReservationsPricing();
      })
      .then(() => {
        console.log('🎉 Migración completada');
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
  } else {
    migrateReservationsPricing()
      .then(() => {
        console.log('🎉 Migración completada');
      })
      .catch(error => {
        console.error('❌ Error:', error);
      });
  }
}

module.exports = migrateReservationsPricing;