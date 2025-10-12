const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function verificarTodasLasHabitaciones() {
    try {
        console.log('=== VERIFICACIÓN COMPLETA DE HABITACIONES - DÍA 10 OCTUBRE 2025 ===\n');
        
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Conectado a MongoDB\n');

        const fechaObjetivo = new Date('2025-10-10');
        
        // 1. Obtener TODAS las habitaciones
        console.log('--- 1. TODAS LAS HABITACIONES EN EL SISTEMA ---');
        const todasLasHabitaciones = await Room.find({}).sort({ number: 1 });
        
        console.log(`📊 Total de habitaciones: ${todasLasHabitaciones.length}\n`);
        
        const habitacionesPorTipo = {};
        
        todasLasHabitaciones.forEach(hab => {
            console.log(`🏠 Habitación ${hab.number}:`);
            console.log(`   - Tipo: ${hab.type}`);
            console.log(`   - Estado: ${hab.status}`);
            console.log(`   - Capacidad: ${hab.capacity || 'No definida'}`);
            console.log(`   - Precio: $${hab.price}/noche\n`);
            
            if (!habitacionesPorTipo[hab.type]) {
                habitacionesPorTipo[hab.type] = [];
            }
            habitacionesPorTipo[hab.type].push(hab);
        });

        // 2. Resumen por tipos
        console.log('--- 2. RESUMEN POR TIPOS DE HABITACIÓN ---');
        Object.keys(habitacionesPorTipo).forEach(tipo => {
            const habitaciones = habitacionesPorTipo[tipo];
            console.log(`\n${tipo.toUpperCase()}:`);
            console.log(`  Total: ${habitaciones.length}`);
            
            const disponibles = habitaciones.filter(h => h.status === 'available').length;
            const ocupadas = habitaciones.filter(h => h.status === 'ocupada').length;
            const mantenimiento = habitaciones.filter(h => h.status === 'maintenance').length;
            
            console.log(`  - Disponibles: ${disponibles}`);
            console.log(`  - Ocupadas: ${ocupadas}`);
            console.log(`  - Mantenimiento: ${mantenimiento}`);
            
            habitaciones.forEach(h => {
                console.log(`    • ${h.number}: ${h.status}`);
            });
        });

        // 3. Verificar reservas para el día 10
        console.log('\n--- 3. RESERVAS PARA EL DÍA 10 DE OCTUBRE ---');
        
        // Reservas con habitación asignada
        const reservasConHabitacion = await Reservation.find({
            status: { $in: ['confirmed', 'checked-in'] },
            checkInDate: { $lte: fechaObjetivo },
            checkOutDate: { $gt: fechaObjetivo },
            roomId: { $ne: null }
        }).populate('roomId').populate('clientId');

        console.log(`📊 Reservas con habitación asignada: ${reservasConHabitacion.length}`);
        
        reservasConHabitacion.forEach((reserva, index) => {
            console.log(`\n  Reserva ${index + 1}:`);
            console.log(`  - Habitación: ${reserva.roomId ? reserva.roomId.number : 'No asignada'}`);
            console.log(`  - Tipo: ${reserva.roomType}`);
            console.log(`  - Estado: ${reserva.status}`);
            console.log(`  - Check-in: ${reserva.checkInDate.toLocaleDateString('es-ES')}`);
            console.log(`  - Check-out: ${reserva.checkOutDate.toLocaleDateString('es-ES')}`);
            console.log(`  - Cliente: ${reserva.clientId ? reserva.clientId.name : 'No asignado'}`);
        });

        // Reservas virtuales (sin habitación asignada)
        const reservasVirtuales = await Reservation.find({
            status: { $in: ['confirmed', 'checked-in'] },
            checkInDate: { $lte: fechaObjetivo },
            checkOutDate: { $gt: fechaObjetivo },
            roomId: null
        }).populate('clientId');

        console.log(`\n📊 Reservas virtuales (sin habitación): ${reservasVirtuales.length}`);
        
        reservasVirtuales.forEach((reserva, index) => {
            console.log(`\n  Reserva virtual ${index + 1}:`);
            console.log(`  - Tipo solicitado: ${reserva.roomType}`);
            console.log(`  - Estado: ${reserva.status}`);
            console.log(`  - Check-in: ${reserva.checkInDate.toLocaleDateString('es-ES')}`);
            console.log(`  - Check-out: ${reserva.checkOutDate.toLocaleDateString('es-ES')}`);
            console.log(`  - Cliente: ${reserva.clientId ? reserva.clientId.name : 'No asignado'}`);
        });

        // 4. Análisis específico de disponibilidad para dobles
        console.log('\n--- 4. ANÁLISIS DE DISPONIBILIDAD PARA HABITACIONES DOBLES ---');
        
        const habitacionesDobles = habitacionesPorTipo['doble'] || [];
        console.log(`📊 Habitaciones dobles encontradas: ${habitacionesDobles.length}`);
        
        if (habitacionesDobles.length === 0) {
            console.log('❌ PROBLEMA CRÍTICO: No se encontraron habitaciones dobles en el sistema');
            
            // Verificar si hay habitaciones con tipos similares
            const tiposEncontrados = Object.keys(habitacionesPorTipo);
            console.log(`Tipos de habitación encontrados: ${tiposEncontrados.join(', ')}`);
            
            // Buscar posibles variaciones
            const posiblesDobles = todasLasHabitaciones.filter(h => 
                h.type && (
                    h.type.toLowerCase().includes('doble') ||
                    h.type.toLowerCase().includes('double') ||
                    h.type.toLowerCase().includes('matrimonial')
                )
            );
            
            if (posiblesDobles.length > 0) {
                console.log(`\n🔍 Habitaciones que podrían ser dobles:`);
                posiblesDobles.forEach(h => {
                    console.log(`  - ${h.number}: tipo "${h.type}"`);
                });
            }
        } else {
            console.log('\n📋 Estado de habitaciones dobles:');
            habitacionesDobles.forEach(hab => {
                const reservaActiva = reservasConHabitacion.find(r => 
                    r.roomId && r.roomId._id.toString() === hab._id.toString()
                );
                
                console.log(`  🏠 Habitación ${hab.number}:`);
                console.log(`     - Estado en BD: ${hab.status}`);
                console.log(`     - Reserva activa día 10: ${reservaActiva ? 'SÍ' : 'NO'}`);
                
                if (reservaActiva) {
                    console.log(`     - Cliente: ${reservaActiva.clientId ? reservaActiva.clientId.name : 'No asignado'}`);
                    console.log(`     - Checkout: ${reservaActiva.checkOutDate.toLocaleDateString('es-ES')}`);
                }
            });
        }

        console.log('\n=== FIN DE LA VERIFICACIÓN ===');

    } catch (error) {
        console.error('Error en verificación:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Desconectado de MongoDB');
    }
}

verificarTodasLasHabitaciones();