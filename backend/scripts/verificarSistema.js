const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function probarSistemaReservas() {
    try {
        console.log('=== VERIFICACIÓN DEL SISTEMA DE RESERVAS ===\n');
        
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Conectado a MongoDB\n');

        const fecha10 = new Date('2025-10-10');
        const fecha11 = new Date('2025-10-11');

        // 1. Verificar estado actual de habitación 101
        console.log('--- 1. ESTADO ACTUAL HABITACIÓN 101 ---');
        const habitacion101 = await Room.findOne({ number: '101' });
        console.log(`✓ Habitación 101: ${habitacion101.status}`);

        // 2. Simular consulta de disponibilidad como lo hace la API
        console.log('\n--- 2. SIMULACIÓN DE CONSULTA DE DISPONIBILIDAD ---');
        
        const type = 'doble';
        const checkIn = '2025-10-10';
        const checkOut = '2025-10-11';

        console.log(`Parámetros: type=${type}, checkIn=${checkIn}, checkOut=${checkOut}`);

        // Obtener todas las habitaciones dobles
        const allRooms = await Room.find({ type }).sort({ number: 1 });
        console.log(`\n📊 Habitaciones dobles totales: ${allRooms.length}`);
        
        allRooms.forEach(room => {
            console.log(`  - #${room.number}: ${room.status}`);
        });

        // Buscar reservas que se solapan
        const overlappingReservations = await Reservation.find({
            status: { $in: ['reservada', 'checkin'] },
            checkIn: { $lt: new Date(checkOut) },
            checkOut: { $gt: new Date(checkIn) }
        }).populate('room');

        console.log(`\n📊 Reservas solapantes encontradas: ${overlappingReservations.length}`);

        const occupiedRoomIds = new Set();
        let virtualReservationsCount = 0;

        overlappingReservations.forEach(reservation => {
            if (reservation.room && reservation.room.length > 0) {
                reservation.room.forEach(roomObj => {
                    if (roomObj.type === type) {
                        occupiedRoomIds.add(roomObj._id.toString());
                        console.log(`    - Habitación ocupada: #${roomObj.number}`);
                    }
                });
            } else if (reservation.tipo === type) {
                virtualReservationsCount += reservation.cantidad || 1;
                console.log(`    - Reserva virtual: ${reservation.cantidad || 1} habitaciones ${type}`);
            }
        });

        // Filtrar habitaciones disponibles
        const availableRooms = allRooms.filter(room => {
            if (room.status === 'mantenimiento' || room.status === 'ocupada') {
                return false;
            }
            if (occupiedRoomIds.has(room._id.toString())) {
                return false;
            }
            return true;
        });

        const physicallyAvailable = availableRooms.length;
        const reallyAvailable = Math.max(0, physicallyAvailable - virtualReservationsCount);

        console.log(`\n📊 RESULTADO DE DISPONIBILIDAD:`);
        console.log(`  - Habitaciones físicamente disponibles: ${physicallyAvailable}`);
        console.log(`  - Reservas virtuales pendientes: ${virtualReservationsCount}`);
        console.log(`  - Habitaciones realmente disponibles: ${reallyAvailable}`);

        console.log(`\n🎯 HABITACIONES DISPONIBLES PARA RESERVA:`);
        availableRooms.forEach(room => {
            console.log(`  ✅ #${room.number} (${room.type}) - $${room.price}/noche`);
        });

        // 3. Verificar disponibilidad específica para diferentes fechas
        console.log('\n--- 3. DISPONIBILIDAD POR FECHAS ---');
        
        const fechasProbar = [
            { fecha: '2025-10-10', nombre: '10 de octubre' },
            { fecha: '2025-10-11', nombre: '11 de octubre' },
            { fecha: '2025-10-12', nombre: '12 de octubre' }
        ];

        for (const { fecha, nombre } of fechasProbar) {
            const checkInTest = fecha;
            const checkOutTest = new Date(fecha);
            checkOutTest.setDate(checkOutTest.getDate() + 1);
            
            const reservasEnFecha = await Reservation.find({
                status: { $in: ['reservada', 'checkin'] },
                checkIn: { $lte: new Date(checkInTest) },
                checkOut: { $gt: new Date(checkInTest) }
            }).populate('room');

            const ocupadasEnFecha = new Set();
            reservasEnFecha.forEach(r => {
                if (r.room && r.room.length > 0) {
                    r.room.forEach(hab => {
                        if (hab.type === 'doble') {
                            ocupadasEnFecha.add(hab.number);
                        }
                    });
                }
            });

            const disponiblesEnFecha = allRooms.filter(h => 
                h.status === 'disponible' && !ocupadasEnFecha.has(h.number)
            );

            console.log(`\n📅 ${nombre}:`);
            console.log(`  - Habitaciones dobles disponibles: ${disponiblesEnFecha.length}`);
            disponiblesEnFecha.forEach(h => {
                console.log(`    ✅ #${h.number}`);
            });
        }

        console.log('\n--- 4. RECOMENDACIONES ---');
        
        if (reallyAvailable > 0) {
            console.log(`✅ ¡SISTEMA FUNCIONANDO CORRECTAMENTE!`);
            console.log(`   - Hay ${reallyAvailable} habitación(es) doble(s) disponible(s) para el día 10`);
            console.log(`   - Los usuarios deberían poder hacer reservas ahora`);
            console.log(`   - Recomendación: Probar el frontend para confirmar`);
        } else {
            console.log(`⚠️  Aún hay problemas con la disponibilidad`);
            console.log(`   - Habitaciones físicamente disponibles: ${physicallyAvailable}`);
            console.log(`   - Pero hay ${virtualReservationsCount} reservas virtuales pendientes`);
        }

        console.log('\n=== FIN DE LA VERIFICACIÓN ===');

    } catch (error) {
        console.error('Error en verificación:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Desconectado de MongoDB');
    }
}

probarSistemaReservas();