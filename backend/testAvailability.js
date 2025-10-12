// Script para probar la disponibilidad de habitaciones
const axios = require('axios');

async function testAvailability() {
    try {
        console.log('🔍 Probando disponibilidad de habitaciones...');
        
        const response = await axios.get('http://localhost:5000/api/rooms/availability', {
            params: {
                checkIn: '2025-10-06',
                checkOut: '2025-10-07',
                roomType: 'doble'
            }
        });
        
        console.log('✅ Respuesta de la API:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Analizar los resultados
        if (response.data.success) {
            const availableRooms = response.data.data.availableRooms;
            console.log(`\n📊 Análisis de resultados:`);
            console.log(`- Habitaciones disponibles: ${availableRooms.length}`);
            console.log(`- Tipo solicitado: doble`);
            console.log(`- Fecha: 2025-10-06 a 2025-10-07`);
            
            if (availableRooms.length > 0) {
                console.log('\n🏨 Habitaciones disponibles:');
                availableRooms.forEach(room => {
                    console.log(`  - Habitación ${room.roomNumber} (${room.type}) - Estado: ${room.status}`);
                });
            }
        } else {
            console.log('❌ Error en la consulta:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error al conectar con la API:', error.message);
        
        if (error.response) {
            console.error('Código de estado:', error.response.status);
            console.error('Respuesta del servidor:', error.response.data);
        }
    }
}

testAvailability();