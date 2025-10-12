const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function mantenimientoHabitaciones() {
    try {
        console.log('=== MANTENIMIENTO AUTOMÁTICO DE HABITACIONES ===\n');
        
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Conectado a MongoDB\n');

        const fechaHoy = new Date();
        fechaHoy.setHours(0, 0, 0, 0);

        console.log(`📅 Fecha de referencia: ${fechaHoy.toLocaleDateString('es-ES')}\n`);

        // 1. Buscar habitaciones marcadas como ocupadas
        console.log('--- 1. IDENTIFICANDO HABITACIONES MARCADAS COMO OCUPADAS ---');
        
        const habitacionesOcupadas = await Room.find({ status: 'ocupada' });
        console.log(`📊 Habitaciones marcadas como ocupadas: ${habitacionesOcupadas.length}`);

        if (habitacionesOcupadas.length === 0) {
            console.log('✅ No hay habitaciones marcadas como ocupadas. Sistema limpio.\n');
        } else {
            console.log('\nHabitaciones ocupadas encontradas:');
            habitacionesOcupadas.forEach(h => {
                console.log(`  - #${h.number} (${h.type})`);
            });
        }

        // 2. Verificar cuáles tienen reservas activas reales
        console.log('\n--- 2. VERIFICANDO RESERVAS ACTIVAS REALES ---');
        
        const reservasActivas = await Reservation.find({
            status: { $in: ['reservada', 'checkin'] },
            checkOut: { $gt: fechaHoy }
        }).populate('room');

        console.log(`📊 Reservas activas encontradas: ${reservasActivas.length}`);

        // Crear set de habitaciones que realmente tienen reservas activas
        const habitacionesConReservaActiva = new Set();
        
        reservasActivas.forEach(reserva => {
            if (reserva.room && reserva.room.length > 0) {
                reserva.room.forEach(habitacion => {
                    habitacionesConReservaActiva.add(habitacion._id.toString());
                    console.log(`  ✓ #${habitacion.number} tiene reserva activa hasta ${reserva.checkOut.toLocaleDateString('es-ES')}`);
                });
            }
        });

        // 3. Identificar habitaciones bloqueadas sin reserva
        console.log('\n--- 3. IDENTIFICANDO HABITACIONES BLOQUEADAS SIN RESERVA ---');
        
        const habitacionesBloqueadas = habitacionesOcupadas.filter(habitacion => {
            return !habitacionesConReservaActiva.has(habitacion._id.toString());
        });

        console.log(`📊 Habitaciones bloqueadas sin reserva: ${habitacionesBloqueadas.length}`);

        if (habitacionesBloqueadas.length === 0) {
            console.log('✅ No se encontraron habitaciones bloqueadas sin reserva.\n');
        } else {
            console.log('\n🔧 HABITACIONES A LIBERAR:');
            
            for (const habitacion of habitacionesBloqueadas) {
                console.log(`\n  📍 Habitación #${habitacion.number} (${habitacion.type}):`);
                console.log(`     - Estado actual: ${habitacion.status}`);
                console.log(`     - Sin reserva activa`);
                console.log(`     - ⚡ Liberando automáticamente...`);

                // Liberar la habitación
                const resultado = await Room.updateOne(
                    { _id: habitacion._id },
                    { $set: { status: 'disponible' } }
                );

                if (resultado.modifiedCount === 1) {
                    console.log(`     ✅ Habitación #${habitacion.number} liberada exitosamente`);
                } else {
                    console.log(`     ❌ Error al liberar habitación #${habitacion.number}`);
                }
            }
        }

        // 4. Verificar reservas vencidas
        console.log('\n--- 4. VERIFICANDO RESERVAS VENCIDAS ---');
        
        const reservasVencidas = await Reservation.find({
            status: { $in: ['reservada', 'checkin'] },
            checkOut: { $lte: fechaHoy }
        }).populate('room');

        console.log(`📊 Reservas vencidas encontradas: ${reservasVencidas.length}`);

        if (reservasVencidas.length === 0) {
            console.log('✅ No hay reservas vencidas pendientes de checkout.\n');
        } else {
            console.log('\n🔧 RESERVAS VENCIDAS A PROCESAR:');
            
            for (const reserva of reservasVencidas) {
                console.log(`\n  📍 Reserva ID: ${reserva._id}`);
                console.log(`     - Checkout programado: ${reserva.checkOut.toLocaleDateString('es-ES')}`);
                console.log(`     - Estado actual: ${reserva.status}`);
                
                if (reserva.room && reserva.room.length > 0) {
                    console.log(`     - Habitaciones: ${reserva.room.map(h => h.number).join(', ')}`);
                    console.log(`     - ⚡ Procesando checkout automático...`);

                    // Marcar reserva como checkout
                    const resultadoReserva = await Reservation.updateOne(
                        { _id: reserva._id },
                        { $set: { status: 'checkout' } }
                    );

                    // Liberar habitaciones asociadas
                    for (const habitacion of reserva.room) {
                        const resultadoHabitacion = await Room.updateOne(
                            { _id: habitacion._id },
                            { $set: { status: 'disponible' } }
                        );
                        
                        if (resultadoHabitacion.modifiedCount === 1) {
                            console.log(`     ✅ Habitación #${habitacion.number} liberada`);
                        }
                    }

                    if (resultadoReserva.modifiedCount === 1) {
                        console.log(`     ✅ Reserva marcada como checkout`);
                    }
                } else {
                    console.log(`     - Reserva virtual, marcando como checkout...`);
                    await Reservation.updateOne(
                        { _id: reserva._id },
                        { $set: { status: 'checkout' } }
                    );
                    console.log(`     ✅ Reserva virtual marcada como checkout`);
                }
            }
        }

        // 5. Resumen final
        console.log('\n--- 5. RESUMEN DE MANTENIMIENTO ---');
        
        const habitacionesFinales = await Room.find({}).sort({ number: 1 });
        const estadisticas = {};
        
        habitacionesFinales.forEach(h => {
            if (!estadisticas[h.status]) estadisticas[h.status] = 0;
            estadisticas[h.status]++;
        });

        console.log('\n📊 ESTADO FINAL DE HABITACIONES:');
        Object.keys(estadisticas).forEach(estado => {
            console.log(`  - ${estado}: ${estadisticas[estado]} habitaciones`);
        });

        console.log('\n✅ MANTENIMIENTO COMPLETADO');
        console.log(`   - Habitaciones liberadas: ${habitacionesBloqueadas.length}`);
        console.log(`   - Reservas procesadas: ${reservasVencidas.length}`);
        console.log(`   - Sistema optimizado y listo para uso\n`);

        console.log('=== FIN DEL MANTENIMIENTO ===');

    } catch (error) {
        console.error('Error en mantenimiento:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Desconectado de MongoDB');
    }
}

// Ejecutar mantenimiento si es llamado directamente
if (require.main === module) {
    mantenimientoHabitaciones();
}

module.exports = { mantenimientoHabitaciones };