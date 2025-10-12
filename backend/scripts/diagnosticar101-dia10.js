const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function diagnosticarHabitacion101() {
    try {
        console.log('=== DIAGNÓSTICO HABITACIÓN 101 - DÍA 10 OCTUBRE 2025 ===\n');
        
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Conectado a MongoDB\n');

        const fechaObjetivo = new Date('2025-10-10');
        const fechaConsulta = new Date();
        console.log(`📅 Fecha objetivo: ${fechaObjetivo.toLocaleDateString('es-ES')}`);
        console.log(`📅 Fecha actual: ${fechaConsulta.toLocaleDateString('es-ES')}\n`);

        // 1. Verificar habitación 101
        console.log('--- 1. INFORMACIÓN DE LA HABITACIÓN 101 ---');
        const habitacion101 = await Room.findOne({ number: '101' });
        
        if (!habitacion101) {
            console.log('❌ ERROR: No se encontró la habitación 101');
            return;
        }

        console.log(`✓ Habitación encontrada:`);
        console.log(`  - Número: ${habitacion101.number}`);
        console.log(`  - Tipo: ${habitacion101.type}`);
        console.log(`  - Estado: ${habitacion101.status}`);
        console.log(`  - Capacidad: ${habitacion101.capacity} personas`);
        console.log(`  - Precio: $${habitacion101.price}/noche\n`);

        // 2. Buscar reservas que afecten el día 10
        console.log('--- 2. RESERVAS QUE AFECTAN LA HABITACIÓN 101 ---');
        
        const reservasActivas = await Reservation.find({
            roomId: habitacion101._id,
            status: { $in: ['confirmed', 'checked-in'] },
            $or: [
                {
                    // Reservas que incluyen el día 10
                    checkInDate: { $lte: fechaObjetivo },
                    checkOutDate: { $gt: fechaObjetivo }
                },
                {
                    // Reservas que terminan el día 10
                    checkInDate: { $lte: fechaObjetivo },
                    checkOutDate: { $eq: fechaObjetivo }
                }
            ]
        }).populate('clientId');

        console.log(`📊 Reservas encontradas: ${reservasActivas.length}`);
        
        if (reservasActivas.length === 0) {
            console.log('✓ No hay reservas activas para la habitación 101 el día 10');
        } else {
            reservasActivas.forEach((reserva, index) => {
                console.log(`\n  Reserva ${index + 1}:`);
                console.log(`  - ID: ${reserva._id}`);
                console.log(`  - Estado: ${reserva.status}`);
                console.log(`  - Check-in: ${reserva.checkInDate.toLocaleDateString('es-ES')}`);
                console.log(`  - Check-out: ${reserva.checkOutDate.toLocaleDateString('es-ES')}`);
                console.log(`  - Cliente: ${reserva.clientId ? reserva.clientId.name : 'No asignado'}`);
                console.log(`  - Huéspedes: ${reserva.guests}`);
                
                // Verificar si la reserva debería haber terminado
                if (reserva.checkOutDate <= fechaConsulta) {
                    console.log(`  ⚠️  PROBLEMA: Esta reserva debería haber terminado el ${reserva.checkOutDate.toLocaleDateString('es-ES')}`);
                }
            });
        }

        // 3. Verificar reservas virtuales
        console.log('\n--- 3. RESERVAS VIRTUALES PARA HABITACIONES DOBLES DÍA 10 ---');
        
        const reservasVirtuales = await Reservation.find({
            roomId: null,
            roomType: 'doble',
            status: { $in: ['confirmed', 'checked-in'] },
            checkInDate: { $lte: fechaObjetivo },
            checkOutDate: { $gt: fechaObjetivo }
        }).populate('clientId');

        console.log(`📊 Reservas virtuales encontradas: ${reservasVirtuales.length}`);
        
        reservasVirtuales.forEach((reserva, index) => {
            console.log(`\n  Reserva virtual ${index + 1}:`);
            console.log(`  - ID: ${reserva._id}`);
            console.log(`  - Tipo solicitado: ${reserva.roomType}`);
            console.log(`  - Estado: ${reserva.status}`);
            console.log(`  - Check-in: ${reserva.checkInDate.toLocaleDateString('es-ES')}`);
            console.log(`  - Check-out: ${reserva.checkOutDate.toLocaleDateString('es-ES')}`);
            console.log(`  - Cliente: ${reserva.clientId ? reserva.clientId.name : 'No asignado'}`);
        });

        // 4. Calcular disponibilidad usando la misma lógica del controlador
        console.log('\n--- 4. CÁLCULO DE DISPONIBILIDAD PARA DOBLES DÍA 10 ---');
        
        const todasHabitacionesDobles = await Room.find({ 
            type: 'doble',
            status: 'available'
        });
        console.log(`📊 Total habitaciones dobles en sistema: ${todasHabitacionesDobles.length}`);
        
        todasHabitacionesDobles.forEach(hab => {
            console.log(`  - Habitación ${hab.number}: ${hab.status}`);
        });

        // Reservas reales (con habitación asignada)
        const reservasReales = await Reservation.find({
            roomType: 'doble',
            status: { $in: ['confirmed', 'checked-in'] },
            checkInDate: { $lte: fechaObjetivo },
            checkOutDate: { $gt: fechaObjetivo },
            roomId: { $ne: null }
        });

        // Reservas virtuales (sin habitación asignada)
        const reservasVirtualesTotales = await Reservation.find({
            roomType: 'doble',
            status: { $in: ['confirmed', 'checked-in'] },
            checkInDate: { $lte: fechaObjetivo },
            checkOutDate: { $gt: fechaObjetivo },
            roomId: null
        });

        const habitacionesOcupadas = reservasReales.length;
        const reservasPendientesAsignacion = reservasVirtualesTotales.length;
        const habitacionesDisponibles = Math.max(0, todasHabitacionesDobles.length - habitacionesOcupadas - reservasPendientesAsignacion);

        console.log(`\n📊 RESUMEN DE DISPONIBILIDAD:`);
        console.log(`  - Habitaciones dobles totales: ${todasHabitacionesDobles.length}`);
        console.log(`  - Habitaciones ocupadas (reservas reales): ${habitacionesOcupadas}`);
        console.log(`  - Reservas pendientes de asignación: ${reservasPendientesAsignacion}`);
        console.log(`  - Habitaciones disponibles: ${habitacionesDisponibles}`);

        // 5. Verificar estado específico de la habitación 101 para reserva
        console.log('\n--- 5. DISPONIBILIDAD ESPECÍFICA HABITACIÓN 101 DÍA 10 ---');
        
        const puedeReservar101 = reservasActivas.length === 0;
        console.log(`¿Se puede reservar habitación 101 para el día 10? ${puedeReservar101 ? '✅ SÍ' : '❌ NO'}`);
        
        if (!puedeReservar101) {
            console.log('Motivo: Hay reservas activas que ocupan la habitación el día 10');
        }

        console.log('\n=== FIN DEL DIAGNÓSTICO ===');

    } catch (error) {
        console.error('Error en diagnóstico:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Desconectado de MongoDB');
    }
}

diagnosticarHabitacion101();