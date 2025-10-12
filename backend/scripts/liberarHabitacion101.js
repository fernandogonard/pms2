const mongoose = require('mongoose');
const Room = require('../models/Room');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-hotelero';

async function liberarHabitacion101() {
    try {
        console.log('=== LIBERACIÓN DE HABITACIÓN 101 ===\n');
        
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Conectado a MongoDB\n');

        // Buscar habitación 101
        const habitacion101 = await Room.findOne({ number: '101' });
        
        if (!habitacion101) {
            console.log('❌ ERROR: No se encontró la habitación 101');
            return;
        }

        console.log(`📍 Estado actual de habitación 101:`);
        console.log(`   - Número: ${habitacion101.number}`);
        console.log(`   - Tipo: ${habitacion101.type}`);
        console.log(`   - Estado actual: ${habitacion101.status}`);
        console.log(`   - Precio: $${habitacion101.price}/noche\n`);

        if (habitacion101.status === 'disponible') {
            console.log('✅ La habitación 101 ya está disponible. No se requiere acción.');
        } else {
            console.log(`🔧 Cambiando estado de '${habitacion101.status}' a 'disponible'...`);
            
            // Actualizar el estado
            const resultado = await Room.updateOne(
                { number: '101' },
                { $set: { status: 'disponible' } }
            );

            if (resultado.modifiedCount === 1) {
                console.log('✅ ¡Habitación 101 liberada exitosamente!');
                
                // Verificar el cambio
                const habitacionActualizada = await Room.findOne({ number: '101' });
                console.log(`✓ Estado confirmado: ${habitacionActualizada.status}`);
                
                console.log('\n🎉 RESULTADO:');
                console.log('   - La habitación 101 ahora está DISPONIBLE para reservas');
                console.log('   - Los usuarios pueden reservar para el día 10 de octubre');
                console.log('   - El sistema debería mostrar 1 habitación doble disponible');
                
            } else {
                console.log('❌ ERROR: No se pudo actualizar la habitación');
            }
        }

        console.log('\n=== FIN DE LA LIBERACIÓN ===');

    } catch (error) {
        console.error('Error al liberar habitación:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Desconectado de MongoDB');
    }
}

liberarHabitacion101();