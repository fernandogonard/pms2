// Script para forzar actualización del Service Worker
// Ejecutar en la consola del navegador para limpiar cache y actualizar SW

async function forceServiceWorkerUpdate() {
  console.log('🔄 Iniciando actualización forzada del Service Worker...');
  
  try {
    // 1. Desregistrar todos los Service Workers existentes
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`📋 Encontrados ${registrations.length} Service Workers registrados`);
      
      for (let registration of registrations) {
        console.log('🗑️ Desregistrando SW:', registration.scope);
        await registration.unregister();
      }
    }
    
    // 2. Limpiar todos los caches
    const cacheNames = await caches.keys();
    console.log(`🧹 Limpiando ${cacheNames.length} caches...`);
    
    for (let cacheName of cacheNames) {
      console.log('🗑️ Eliminando cache:', cacheName);
      await caches.delete(cacheName);
    }
    
    // 3. Limpiar localStorage y sessionStorage
    console.log('🧹 Limpiando almacenamiento local...');
    localStorage.clear();
    sessionStorage.clear();
    
    // 4. Registrar nuevo Service Worker
    console.log('📥 Registrando nuevo Service Worker...');
    const registration = await navigator.serviceWorker.register('/sw.js?v=' + Date.now());
    console.log('✅ Service Worker registrado exitosamente:', registration.scope);
    
    // 5. Esperar a que el nuevo SW esté activo
    if (registration.installing) {
      console.log('⏳ Esperando activación del Service Worker...');
      await new Promise((resolve) => {
        registration.installing.addEventListener('statechange', function() {
          if (this.state === 'activated') {
            resolve();
          }
        });
      });
    }
    
    console.log('🎉 ¡Actualización completada! Recargando página...');
    
    // 6. Recargar la página
    setTimeout(() => {
      window.location.reload(true);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error durante la actualización:', error);
  }
}

// Ejecutar automáticamente
forceServiceWorkerUpdate();