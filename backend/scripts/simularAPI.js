const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function probarAPIDisponibilidad() {
    try {
        console.log('=== SIMULACIÓN EXACTA DE LA API getAvailableRooms ===\n');
        
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Conectado a MongoDB\n');

        // Parámetros de prueba (simulando la consulta del frontend)
        const type = 'doble';
        const checkIn = '2025-10-10';
        const checkOut = '2025-10-11';
        const cantidad = '1';

        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Consulta disponibilidad NUEVA`);
        console.log(`Parámetros: type=${type}, checkIn=${checkIn}, checkOut=${checkOut}, cantidad=${cantidad}\n`);

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        // PASO 1: Obtener TODAS las habitaciones del tipo solicitado
        const allRooms = await Room.find({ type }).sort({ number: 1 }).lean();
        
        console.log(`[${timestamp}] Habitaciones totales encontradas: ${allRooms.length}`);
        allRooms.forEach(r => {
            console.log(`  - #${r.number}: ${r.status}`);
        });

        // PASO 2: Buscar reservas que se solapan
        const overlappingReservations = await Reservation.find({
            status: { $in: ['reservada', 'checkin'] },
            checkIn: { $lt: checkOutDate },
            checkOut: { $gt: checkInDate }
        }).populate('room').lean();

        console.log(`\n[${timestamp}] Reservas solapantes: ${overlappingReservations.length}`);

        // PASO 3: Procesar ocupaciones
        const occupiedRoomIds = new Set();
        let virtualReservationsCount = 0;

        overlappingReservations.forEach(reservation => {
            console.log(`\nProcesando reserva:`);
            console.log(`  - ID: ${reservation._id}`);
            console.log(`  - Tipo: ${reservation.tipo || 'No definido'}`);
            console.log(`  - Cantidad: ${reservation.cantidad || 'No definido'}`);
            console.log(`  - Habitaciones asignadas: ${reservation.room?.length || 0}`);

            if (reservation.room && reservation.room.length > 0) {
                // Reserva con habitaciones asignadas
                reservation.room.forEach(roomObj => {
                    occupiedRoomIds.add(roomObj._id.toString());
                    console.log(`  - Habitación ocupada por reserva: #${roomObj.number}`);
                });
            } else if (reservation.tipo === type) {
                // Reserva virtual del mismo tipo
                virtualReservationsCount += reservation.cantidad || 1;
                console.log(`  - Reserva virtual del tipo ${reservation.tipo}: +${reservation.cantidad || 1}`);
            }
        });

        console.log(`\nRESUMEN DE OCUPACIONES:`);
        console.log(`  - Habitaciones ocupadas por reservas reales: ${occupiedRoomIds.size}`);
        console.log(`  - Reservas virtuales pendientes: ${virtualReservationsCount}`);

        // PASO 4: Filtrar habitaciones realmente disponibles
        console.log(`\nFILTRADO DE HABITACIONES:`);
        const availableRooms = allRooms.filter(room => {
            console.log(`\nEvaluando habitación #${room.number}:`);
            
            // Excluir mantenimiento
            if (room.status === 'mantenimiento') {
                console.log(`  ❌ Excluida: está en mantenimiento`);
                return false;
            }
            
            // Excluir ocupadas por estado
            if (room.status === 'ocupada') {
                console.log(`  ❌ Excluida: estado 'ocupada' en BD`);
                return false;
            }
            
            // Excluir ocupadas por reservas
            if (occupiedRoomIds.has(room._id.toString())) {
                console.log(`  ❌ Excluida: tiene reserva real activa`);
                return false;
            }
            
            console.log(`  ✅ Disponible para reserva`);
            return true;
        });

        // PASO 5: Calcular disponibilidad final
        const physicallyAvailable = availableRooms.length;
        const reallyAvailable = Math.max(0, physicallyAvailable - virtualReservationsCount);

        console.log(`\nCÁLCULO FINAL:`);
        console.log(`  - Habitaciones físicamente disponibles: ${physicallyAvailable}`);
        console.log(`  - Reservas virtuales pendientes: ${virtualReservationsCount}`);
        console.log(`  - Habitaciones realmente disponibles: ${reallyAvailable}`);

        // PASO 6: Validar cantidad solicitada
        const cantidadSolicitada = parseInt(cantidad, 10);
        if (reallyAvailable < cantidadSolicitada) {
            console.log(`\n❌ RESULTADO: INSUFICIENTES HABITACIONES`);
            console.log(`   Solicitadas: ${cantidadSolicitada}`);
            console.log(`   Disponibles: ${reallyAvailable}`);
            console.log(`   Mensaje: No hay suficientes habitaciones ${type} disponibles`);
        } else {
            console.log(`\n✅ RESULTADO: HABITACIONES DISPONIBLES`);
            console.log(`   Solicitadas: ${cantidadSolicitada}`);
            console.log(`   Disponibles: ${reallyAvailable}`);
        }

        console.log('\n=== FIN DE LA SIMULACIÓN ===');

    } catch (error) {
        console.error('Error en simulación:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Desconectado de MongoDB');
    }
}

probarAPIDisponibilidad();