// debug/test-api.js
// Script simple para probar la API sin fetch

const http = require('http');

async function testAPI() {
  console.log('🔍 PROBANDO API getRoomsStatus...');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/rooms/status',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('✅ Respuesta recibida');
          console.log(`   Habitaciones: ${jsonData.rooms ? jsonData.rooms.length : 0}`);
          
          if (jsonData.summary) {
            console.log('📊 RESUMEN:');
            console.log(`   Reservas reales: ${jsonData.summary.realReservations}`);
            console.log(`   Política: ${jsonData.summary.policy || 'N/A'}`);
            
            if (jsonData.summary.virtualReservations) {
              console.log('   Reservas virtuales:');
              Object.keys(jsonData.summary.virtualReservations).forEach(tipo => {
                console.log(`     ${tipo}:`);
                Object.keys(jsonData.summary.virtualReservations[tipo]).forEach(fecha => {
                  const cantidad = jsonData.summary.virtualReservations[tipo][fecha];
                  console.log(`       ${fecha}: ${cantidad} habitaciones`);
                });
              });
            }
          }
          
          // Mostrar habitaciones con ocupación
          const occupiedRooms = jsonData.rooms?.filter(room => {
            return Object.values(room.calendar || {}).some(status => 
              status === 'ocupada' || status === 'ocupada_virtual'
            );
          });
          
          if (occupiedRooms && occupiedRooms.length > 0) {
            console.log('\n🏠 HABITACIONES CON OCUPACIÓN:');
            occupiedRooms.forEach(room => {
              console.log(`   ${room.number} (${room.type}):`);
              Object.keys(room.calendar).forEach(date => {
                if (room.calendar[date] !== 'disponible') {
                  console.log(`     ${date}: ${room.calendar[date]}`);
                }
              });
            });
          } else {
            console.log('\n✅ Todas las habitaciones están disponibles o no se encontraron ocupaciones');
          }
          
          resolve(jsonData);
        } catch (error) {
          console.error('❌ Error parseando JSON:', error);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error en petición HTTP:', error);
      reject(error);
    });

    req.end();
  });
}

async function main() {
  try {
    await testAPI();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();