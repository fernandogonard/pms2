// test-server.js
// Test básico del servidor

console.log('Iniciando test del servidor...');

try {
  const mongoose = require('mongoose');
  console.log('✅ Mongoose importado correctamente');
  
  const app = require('./app');
  console.log('✅ App importado correctamente');
  
  // Test de los servicios nuevos
  const stateValidation = require('./services/stateValidationService');
  console.log('✅ StateValidationService importado correctamente');
  
  const roomAssignment = require('./services/roomAssignmentService');
  console.log('✅ RoomAssignmentService importado correctamente');
  
  // Test simple de conexión a MongoDB
  const MONGO_URI = 'mongodb://localhost:27017/crm-hotelero';
  
  mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ Conectado a MongoDB');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error conectando a MongoDB:', err.message);
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Error en imports:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}