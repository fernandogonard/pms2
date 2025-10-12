// scripts/validateTokens.js
// Script para validar y diagnosticar tokens JWT después del cambio de secret

const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './config/.env' });

// Función para verificar un token con el secret actual
function validateToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token válido:', {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role,
      exp: new Date(decoded.exp * 1000).toLocaleString(),
      iat: new Date(decoded.iat * 1000).toLocaleString()
    });
    return true;
  } catch (error) {
    console.log('❌ Token inválido:', error.message);
    if (error.message === 'invalid signature') {
      console.log('🔧 Causa: El token fue generado con un JWT_SECRET diferente');
      console.log('💡 Solución: Volver a hacer login para generar un nuevo token');
    }
    return false;
  }
}

// Generar un token de prueba con el secret actual
function generateTestToken() {
  const testPayload = {
    userId: 'test-user-id',
    email: 'test@example.com',
    role: 'admin'
  };
  
  const token = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
  console.log('🔑 Token de prueba generado:', token);
  console.log('🧪 Validando token de prueba...');
  validateToken(token);
  return token;
}

// Mostrar información del JWT_SECRET actual
function showJWTInfo() {
  console.log('🔐 Información del JWT_SECRET actual:');
  console.log(`   Longitud: ${process.env.JWT_SECRET.length} caracteres`);
  console.log(`   Primeros 10 caracteres: ${process.env.JWT_SECRET.substring(0, 10)}...`);
  console.log(`   Es seguro: ${process.env.JWT_SECRET.length >= 32 ? '✅ Sí' : '❌ No'}`);
}

// Función principal
function main() {
  console.log('🔍 DIAGNÓSTICO DE TOKENS JWT\n');
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'info':
      showJWTInfo();
      break;
      
    case 'test':
      console.log('🧪 Generando y validando token de prueba...\n');
      generateTestToken();
      break;
      
    case 'validate':
      const token = args[1];
      if (!token) {
        console.log('❌ Proporciona un token para validar');
        console.log('   Uso: node validateTokens.js validate <token>');
        return;
      }
      console.log('🔍 Validando token proporcionado...\n');
      validateToken(token);
      break;
      
    default:
      console.log('📚 Comandos disponibles:');
      console.log('   node validateTokens.js info          - Mostrar info del JWT_SECRET');
      console.log('   node validateTokens.js test          - Generar y validar token de prueba');
      console.log('   node validateTokens.js validate <token> - Validar un token específico');
      console.log('\n💡 Contexto:');
      console.log('   Los tokens "invalid signature" son normales después de cambiar JWT_SECRET');
      console.log('   Solución: Hacer logout y login nuevamente en el frontend');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateToken,
  generateTestToken,
  showJWTInfo
};