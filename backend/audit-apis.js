// Comprehensive API Testing Script for CRM Hotelero
// Tests all critical endpoints

const tests = [
  {
    name: 'Health Check',
    method: 'GET',
    url: 'http://localhost:5000/',
    auth: false
  },
  {
    name: 'Login Admin',
    method: 'POST',
    url: 'http://localhost:5000/api/auth/login',
    body: { email: 'admin@hotel.com', password: 'admin123' },
    auth: false
  },
  {
    name: 'Get Room Types',
    method: 'GET',
    url: 'http://localhost:5000/api/rooms/types',
    auth: true
  },
  {
    name: 'Get Rooms',
    method: 'GET',
    url: 'http://localhost:5000/api/rooms',
    auth: true
  },
  {
    name: 'Check Room Availability',
    method: 'GET',
    url: 'http://localhost:5000/api/rooms/available?type=doble&checkIn=2025-10-10&checkOut=2025-10-12',
    auth: true
  },
  {
    name: 'Calculate Billing',
    method: 'POST',
    url: 'http://localhost:5000/api/billing/calculate',
    body: {
      roomType: 'doble',
      checkIn: '2025-10-10',
      checkOut: '2025-10-12',
      guests: 2
    },
    auth: true
  },
  {
    name: 'Get Users (Admin only)',
    method: 'GET',
    url: 'http://localhost:5000/api/users',
    auth: true
  },
  {
    name: 'Get Reservations',
    method: 'GET',
    url: 'http://localhost:5000/api/reservations',
    auth: true
  }
];

async function runTests() {
  let token = null;
  let passedTests = 0;
  let failedTests = 0;
  
  console.log('🧪 INICIANDO AUDITORÍA COMPLETA DE APIs');
  console.log('=======================================');
  
  for (const test of tests) {
    console.log(`\n🔍 Probando: ${test.name}`);
    
    try {
      const options = {
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (test.auth && token) {
        options.headers.Authorization = `Bearer ${token}`;
      }
      
      if (test.body) {
        options.body = JSON.stringify(test.body);
      }
      
      const response = await fetch(test.url, options);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`   ✅ SUCCESS (${response.status})`);
        
        // Guardar token del login
        if (test.name === 'Login Admin' && data.token) {
          token = data.token;
          console.log(`   🔑 Token obtenido: ${token.substring(0, 20)}...`);
        }
        
        // Mostrar información relevante
        if (test.name === 'Get Room Types' && data.roomTypes) {
          console.log(`   📊 ${data.roomTypes.length} tipos de habitación encontrados`);
        }
        
        if (test.name === 'Get Rooms' && data.rooms) {
          console.log(`   🏨 ${data.rooms.length} habitaciones encontradas`);
        }
        
        if (test.name === 'Check Room Availability' && data.available !== undefined) {
          console.log(`   🛏️ ${data.available} habitaciones disponibles`);
        }
        
        if (test.name === 'Calculate Billing' && data.total) {
          console.log(`   💰 Total calculado: $${data.total} ${data.currency}`);
        }
        
        if (test.name === 'Get Reservations' && data.reservations) {
          console.log(`   📋 ${data.reservations.length} reservaciones encontradas`);
        }
        
        passedTests++;
      } else {
        console.log(`   ❌ FAILED (${response.status}): ${data.message || 'Error desconocido'}`);
        failedTests++;
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failedTests++;
    }
  }
  
  console.log('\n📊 RESUMEN DE AUDITORÍA');
  console.log('=======================');
  console.log(`✅ Pruebas exitosas: ${passedTests}`);
  console.log(`❌ Pruebas fallidas: ${failedTests}`);
  console.log(`📊 Tasa de éxito: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 ¡TODAS LAS APIs FUNCIONAN CORRECTAMENTE!');
  } else {
    console.log('\n⚠️ HAY PROBLEMAS QUE REQUIEREN ATENCIÓN');
  }
}

runTests().catch(console.error);