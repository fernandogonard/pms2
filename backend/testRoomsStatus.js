const axios = require('axios');

const BASE_URL = 'http://localhost:5003';

(async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/rooms/status`, {
      params: {
        start: '2025-12-25',
        days: 7
      }
    });

    console.log('✅ Respuesta del endpoint /api/rooms/status:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Error al probar el endpoint /api/rooms/status:');
    if (error.response) {
      console.error('Estado:', error.response.status);
      console.error('Datos:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
})();