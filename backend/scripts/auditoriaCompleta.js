const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const Client = require('../models/Client');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function auditoriaCompleta() {
    try {
        console.log('=== AUDITORÍA COMPLETA DEL CRM HOTELERO ===\n');
        
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Conectado a MongoDB\n');

        const fechaHoy = new Date('2025-10-06');
        const fecha10 = new Date('2025-10-10');
        const fecha11 = new Date('2025-10-11');
        const fecha12 = new Date('2025-10-12');

        // 1. AUDITORÍA DE HABITACIONES
        console.log('--- 1. INVENTARIO COMPLETO DE HABITACIONES ---');
        const todasHabitaciones = await Room.find({}).sort({ number: 1 });
        
        console.log(`📊 Total habitaciones: ${todasHabitaciones.length}\n`);
        
        const inventario = {};
        todasHabitaciones.forEach(hab => {
            if (!inventario[hab.type]) inventario[hab.type] = [];
            inventario[hab.type].push(hab);
        });

        Object.keys(inventario).forEach(tipo => {
            console.log(`${tipo.toUpperCase()}: ${inventario[tipo].length} habitaciones`);
            inventario[tipo].forEach(h => {
                console.log(`  - #${h.number}: ${h.status} ($${h.price}/noche)`);
            });
            console.log();
        });

        // 2. AUDITORÍA DE RESERVAS
        console.log('--- 2. ANÁLISIS COMPLETO DE RESERVAS ---');
        
        // Reservas activas en general
        const reservasActivas = await Reservation.find({
            status: { $in: ['reservada', 'checkin'] }
        }).populate('room').populate('client').sort({ checkIn: 1 });

        console.log(`📊 Total reservas activas: ${reservasActivas.length}\n`);

        // Clasificar reservas
        const reservasConHabitacion = [];
        const reservasVirtuales = [];
        const reservasTerminadas = [];

        reservasActivas.forEach(reserva => {
            const hoy = new Date();
            if (reserva.checkOut <= hoy) {
                reservasTerminadas.push(reserva);
            } else if (reserva.room && reserva.room.length > 0) {
                reservasConHabitacion.push(reserva);
            } else {
                reservasVirtuales.push(reserva);
            }
        });

        console.log(`CLASIFICACIÓN DE RESERVAS:`);
        console.log(`  - Con habitación asignada: ${reservasConHabitacion.length}`);
        console.log(`  - Virtuales (sin habitación): ${reservasVirtuales.length}`);
        console.log(`  - Ya terminadas (deberían estar cerradas): ${reservasTerminadas.length}\n`);

        // 3. ANÁLISIS POR FECHAS ESPECÍFICAS
        console.log('--- 3. ANÁLISIS DETALLADO POR FECHAS ---');
        
        const fechasAnalizar = [
            { fecha: fecha10, nombre: '10 de octubre' },
            { fecha: fecha11, nombre: '11 de octubre' },
            { fecha: fecha12, nombre: '12 de octubre' }
        ];

        for (const { fecha, nombre } of fechasAnalizar) {
            console.log(`\n📅 ${nombre.toUpperCase()} (${fecha.toLocaleDateString('es-ES')}):`);
            
            // Reservas que afectan esta fecha
            const reservasEnFecha = await Reservation.find({
                status: { $in: ['reservada', 'checkin'] },
                checkIn: { $lte: fecha },
                checkOut: { $gt: fecha }
            }).populate('room').populate('client');

            console.log(`  Reservas activas: ${reservasEnFecha.length}`);

            // Habitaciones ocupadas específicamente
            const habitacionesOcupadas = new Set();
            const tiposVirtuales = {};

            reservasEnFecha.forEach(reserva => {
                if (reserva.room && reserva.room.length > 0) {
                    reserva.room.forEach(habitacion => {
                        habitacionesOcupadas.add(habitacion.number);
                        console.log(`    🏠 #${habitacion.number} (${habitacion.type}) - ${reserva.client?.name || reserva.name || 'Sin cliente'}`);
                    });
                } else {
                    const tipo = reserva.tipo || 'no definido';
                    const cantidad = reserva.cantidad || 1;
                    if (!tiposVirtuales[tipo]) tiposVirtuales[tipo] = 0;
                    tiposVirtuales[tipo] += cantidad;
                }
            });

            if (Object.keys(tiposVirtuales).length > 0) {
                console.log(`    📋 Reservas virtuales pendientes:`);
                Object.keys(tiposVirtuales).forEach(tipo => {
                    console.log(`      - ${tipo}: ${tiposVirtuales[tipo]} habitaciones`);
                });
            }

            // Análisis por tipo de habitación
            Object.keys(inventario).forEach(tipo => {
                const totalTipo = inventario[tipo].length;
                const ocupadasTipo = inventario[tipo].filter(h => 
                    habitacionesOcupadas.has(h.number) || h.status === 'ocupada' || h.status === 'mantenimiento'
                ).length;
                const virtualesTipo = tiposVirtuales[tipo] || 0;
                const disponiblesTipo = Math.max(0, totalTipo - ocupadasTipo - virtualesTipo);

                console.log(`    ${tipo}: ${disponiblesTipo}/${totalTipo} disponibles (ocupadas: ${ocupadasTipo}, virtuales: ${virtualesTipo})`);
                
                if (tipo === 'doble' && fecha.getTime() === fecha10.getTime()) {
                    console.log(`      📍 HABITACIONES DOBLES DETALLE:`);
                    inventario[tipo].forEach(h => {
                        const ocupada = habitacionesOcupadas.has(h.number) || h.status === 'ocupada';
                        const estado = ocupada ? '❌ OCUPADA' : '✅ LIBRE';
                        console.log(`        #${h.number}: ${estado} (BD: ${h.status})`);
                        
                        if (h.number === '101') {
                            console.log(`          🔍 HABITACIÓN 101 - ¿Por qué no se puede reservar?`);
                            if (h.status === 'ocupada') {
                                console.log(`            - Estado en BD: ocupada (sin reserva activa)`);
                            }
                        }
                    });
                }
            });
        }

        // 4. VERIFICAR RESERVAS PROBLEMÁTICAS
        console.log('\n--- 4. IDENTIFICACIÓN DE PROBLEMAS ---');
        
        if (reservasTerminadas.length > 0) {
            console.log(`⚠️  PROBLEMA: ${reservasTerminadas.length} reservas ya terminadas pero aún activas:`);
            reservasTerminadas.forEach(r => {
                console.log(`  - ID: ${r._id}`);
                console.log(`    Checkout: ${r.checkOut.toLocaleDateString('es-ES')}`);
                console.log(`    Estado: ${r.status}`);
                console.log(`    Habitación: ${r.room && r.room.length > 0 ? r.room.map(h => h.number).join(', ') : 'Virtual'}`);
            });
        }

        // 5. VERIFICAR COHERENCIA DE DATOS
        console.log('\n--- 5. VERIFICACIÓN DE COHERENCIA ---');
        
        // Habitaciones marcadas como ocupadas sin reserva
        const habitacionesOcupadasSinReserva = todasHabitaciones.filter(h => {
            if (h.status !== 'ocupada') return false;
            
            const tieneReservaActiva = reservasConHabitacion.some(r => 
                r.room && r.room.some(room => room._id.toString() === h._id.toString()) &&
                r.checkOut > fechaHoy
            );
            
            return !tieneReservaActiva;
        });

        if (habitacionesOcupadasSinReserva.length > 0) {
            console.log(`⚠️  INCONSISTENCIA: ${habitacionesOcupadasSinReserva.length} habitaciones marcadas ocupadas sin reserva activa:`);
            habitacionesOcupadasSinReserva.forEach(h => {
                console.log(`  - #${h.number} (${h.type}): ${h.status}`);
            });
        }

        // 6. RECOMENDACIONES
        console.log('\n--- 6. RECOMENDACIONES PARA ARREGLAR EL SISTEMA ---');
        
        if (reservasTerminadas.length > 0) {
            console.log(`1. Ejecutar checkout automático para ${reservasTerminadas.length} reservas vencidas`);
        }
        
        if (habitacionesOcupadasSinReserva.length > 0) {
            console.log(`2. Liberar ${habitacionesOcupadasSinReserva.length} habitaciones sin reserva activa`);
        }
        
        console.log(`3. Verificar proceso de asignación automática de habitaciones`);
        console.log(`4. Revisar lógica de disponibilidad en el frontend`);

        console.log('\n=== FIN DE LA AUDITORÍA ===');

    } catch (error) {
        console.error('Error en auditoría:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Desconectado de MongoDB');
    }
}

auditoriaCompleta();