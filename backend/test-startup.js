// test-startup.js
// Prueba simple de arranque del servidor

console.log('🚀 Iniciando prueba de arranque...');

try {
  console.log('📦 Cargando dependencias...');
  const express = require('express');
  console.log('✅ Express cargado');
  
  const mongoose = require('mongoose');
  console.log('✅ Mongoose cargado');
  
  const dotenv = require('dotenv');
  console.log('✅ Dotenv cargado');
  
  // Cargar variables de entorno
  dotenv.config({ path: './config/.env' });
  console.log('✅ Variables de entorno cargadas');
  console.log(`   PORT: ${process.env.PORT}`);
  console.log(`   MONGO_URI: ${process.env.MONGO_URI}`);
  console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '***hidden***' : 'NOT SET'}`);
  
  // Probar carga de la app
  console.log('📱 Cargando app.js...');
  const app = require('./app');
  console.log('✅ App.js cargado correctamente');
  
  // Probar conexión a MongoDB
  console.log('🔌 Conectando a MongoDB...');
  mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ MongoDB conectado');
    
    // Crear servidor simple
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🎉 Servidor funcionando en puerto ${PORT}`);
      console.log(`📡 Prueba: http://localhost:${PORT}/api/billing/room-types`);
    });
  })
  .catch(error => {
    console.error('❌ Error conectando a MongoDB:', error);
  });
  
} catch (error) {
  console.error('❌ Error en startup:', error);
}