// scripts/generateSecureJWT.js
// Script para generar un JWT_SECRET seguro y actualizar la configuración

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generar una clave segura de 256 bits (32 bytes)
function generateSecureJWTSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// Actualizar el archivo .env con el nuevo JWT_SECRET
function updateEnvFile() {
  const envPath = path.join(__dirname, '../config/.env');
  
  try {
    // Leer el archivo actual
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Generar nuevo JWT_SECRET
    const newJWTSecret = generateSecureJWTSecret();
    
    // Hacer backup del archivo original
    const backupPath = envPath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, envContent);
    console.log(`🔒 Backup creado: ${backupPath}`);
    
    // Actualizar JWT_SECRET
    const updatedContent = envContent.replace(
      /JWT_SECRET=.*/,
      `JWT_SECRET=${newJWTSecret}`
    );
    
    // Escribir el archivo actualizado
    fs.writeFileSync(envPath, updatedContent);
    
    console.log('✅ JWT_SECRET actualizado exitosamente');
    console.log(`🔑 Nuevo JWT_SECRET: ${newJWTSecret}`);
    console.log('⚠️  IMPORTANTE: Reinicia el servidor para que los cambios surtan efecto');
    console.log('⚠️  ADVERTENCIA: Todos los tokens JWT existentes quedarán invalidados');
    
    return newJWTSecret;
    
  } catch (error) {
    console.error('❌ Error actualizando JWT_SECRET:', error.message);
    return null;
  }
}

// Validar la fortaleza del JWT_SECRET actual
function validateCurrentSecret() {
  const envPath = path.join(__dirname, '../config/.env');
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/JWT_SECRET=(.+)/);
    
    if (!match) {
      console.log('❌ No se encontró JWT_SECRET en el archivo .env');
      return false;
    }
    
    const currentSecret = match[1].trim();
    console.log(`🔍 JWT_SECRET actual: ${currentSecret}`);
    
    // Verificar longitud
    if (currentSecret.length < 32) {
      console.log('⚠️  JWT_SECRET es demasiado corto (< 32 caracteres)');
      return false;
    }
    
    // Verificar si es una cadena genérica o débil
    const weakSecrets = [
      'tu_clave_secreta',
      'secret',
      'jwt_secret',
      'mysecret',
      'password',
      'admin',
      '123456'
    ];
    
    if (weakSecrets.includes(currentSecret.toLowerCase())) {
      console.log('⚠️  JWT_SECRET es una cadena genérica conocida (insegura)');
      return false;
    }
    
    // Verificar entropía básica
    const uniqueChars = new Set(currentSecret).size;
    if (uniqueChars < 16) {
      console.log('⚠️  JWT_SECRET tiene baja entropía (pocos caracteres únicos)');
      return false;
    }
    
    console.log('✅ JWT_SECRET actual parece ser seguro');
    return true;
    
  } catch (error) {
    console.error('❌ Error validando JWT_SECRET:', error.message);
    return false;
  }
}

// Generar múltiples opciones de JWT_SECRET para el usuario
function generateMultipleOptions() {
  console.log('\n🔑 Opciones de JWT_SECRET seguros:\n');
  
  for (let i = 1; i <= 3; i++) {
    const secret = generateSecureJWTSecret();
    console.log(`Opción ${i}: ${secret}`);
  }
  
  console.log('\n💡 Características de un JWT_SECRET seguro:');
  console.log('   - Mínimo 32 caracteres de longitud');
  console.log('   - Generado aleatoriamente');
  console.log('   - Alta entropía (muchos caracteres únicos)');
  console.log('   - No debe ser una palabra del diccionario');
  console.log('   - Debe mantenerse completamente privado');
}

// Función principal
function main() {
  console.log('🔐 GENERADOR DE JWT_SECRET SEGURO\n');
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'validate':
      console.log('📋 Validando JWT_SECRET actual...\n');
      validateCurrentSecret();
      break;
      
    case 'generate':
      console.log('🎲 Generando opciones de JWT_SECRET...\n');
      generateMultipleOptions();
      break;
      
    case 'update':
      console.log('🔄 Actualizando JWT_SECRET...\n');
      if (!validateCurrentSecret()) {
        console.log('\n🔧 Procediendo con la actualización...\n');
        updateEnvFile();
      } else {
        console.log('\n✅ El JWT_SECRET actual es seguro. No es necesario actualizar.');
        console.log('   Si deseas forzar la actualización, elimina el JWT_SECRET actual del .env y ejecuta este script nuevamente.');
      }
      break;
      
    case 'force-update':
      console.log('🔧 Forzando actualización de JWT_SECRET...\n');
      updateEnvFile();
      break;
      
    default:
      console.log('📚 Uso del script:');
      console.log('   node generateSecureJWT.js validate     - Validar JWT_SECRET actual');
      console.log('   node generateSecureJWT.js generate     - Generar opciones de JWT_SECRET');
      console.log('   node generateSecureJWT.js update       - Actualizar JWT_SECRET si es inseguro');
      console.log('   node generateSecureJWT.js force-update - Forzar actualización del JWT_SECRET');
      break;
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  generateSecureJWTSecret,
  validateCurrentSecret,
  updateEnvFile
};