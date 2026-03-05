// redirectorService.js - Servicio para redirigir al puerto correcto del backend
// Este servicio se encarga de detectar y redirigir las conexiones al puerto correcto

// Detectar si estamos en producción (no localhost)
const IS_PRODUCTION = typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

// URL estática del backend en producción (Railway)
const RAILWAY_URL = (process.env.REACT_APP_API_URL || 'https://pms2-production.up.railway.app').trim();

// Almacena la URL de WebSocket detectada
let cachedWsUrl = null;

// Almacena el timestamp de la última detección exitosa
let lastDetectionTime = 0;

// Tiempo de caché en milisegundos (10 minutos)
const CACHE_TIME = 10 * 60 * 1000;

/**
 * Obtiene el puerto del backend y redirige el WebSocket al puerto correcto
 */
export async function detectBackendPort() {
  // En producción no hacemos discovery de puertos localhost — la URL es fija (Railway)
  if (IS_PRODUCTION) {
    return { success: true, port: null, wsEndpoint: '/ws', productionUrl: RAILWAY_URL };
  }

  try {
    // Intentamos primero con la ruta relativa para aprovechar la configuración proxy
    try {
      const response = await fetch('/api/system/port', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.port) {
          // Guardar el puerto en localStorage para uso futuro (incluyendo WebSocket)
          localStorage.setItem('backend-port', data.port);
          console.log(`🔌 [Redirector] Puerto del backend detectado: ${data.port}`);
          
          if (data.wsEndpoint) {
            console.log(`🔌 [Redirector] Endpoint WebSocket detectado: ${data.wsEndpoint}`);
          }
          
          // Construir y guardar la URL de WebSocket
          const wsUrl = `ws://localhost:${data.port}/ws`;
          cachedWsUrl = wsUrl;
          lastDetectionTime = Date.now();
          
          return data;
        }
      }
    } catch (innerErr) {
      console.log('Método relativo fallido, intentando directamente con puertos específicos...');
    }

    // Si el método relativo falla, intentar con los puertos más probables directamente
    const possiblePorts = ['5002', '5001', '5000', '3000'];
    
    for (const port of possiblePorts) {
      try {
        // Hacer una petición con timeout para evitar bloqueos largos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const response = await fetch(`http://localhost:${port}/api/system/port`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const detectedPort = data.port || port;
          
          // Guardar en localStorage para futuras referencias
          localStorage.setItem('backend-port', detectedPort);
          
          // Construir y guardar la URL de WebSocket
          const wsUrl = `ws://localhost:${detectedPort}/ws`;
          cachedWsUrl = wsUrl;
          lastDetectionTime = Date.now();
          
          console.log(`🔌 [Redirector] Backend detectado en puerto: ${detectedPort}`);
          return {
            success: true,
            port: detectedPort,
            wsEndpoint: `/ws`
          };
        }
      } catch (innerErr) {
        // Intentar con el siguiente puerto
        console.log(`Puerto ${port} no disponible, probando siguiente...`);
      }
    }
    
    console.warn('🔌 [Redirector] No se pudo obtener información del puerto del backend');
    return null;
  } catch (error) {
    console.error('🔌 [Redirector] Error detectando puerto:', error);
  }
  
  return null;
}

/**
 * Obtiene el endpoint WebSocket correcto basado en el puerto detectado
 * @returns {string} URL WebSocket completa
 */
export function getWebSocketUrl() {
  // En producción usar la URL de Railway con protocolo wss
  if (IS_PRODUCTION) {
    return RAILWAY_URL.replace(/^https?:/, 'wss:').replace(/\/$/, '') + '/ws';
  }

  // Si tenemos una URL en caché y no ha expirado, la devolvemos
  if (cachedWsUrl && (Date.now() - lastDetectionTime) < CACHE_TIME) {
    return cachedWsUrl;
  }
  
  // Obtener el puerto guardado o usar el puerto por defecto
  const savedPort = localStorage.getItem('backend-port') || '5002';
  return `ws://localhost:${savedPort}/ws`;
}

/**
 * Obtiene la URL base de la API (HTTP)
 * @returns {string} URL base de la API
 */
export function getApiBaseUrl() {
  // En producción devolver URL fija de Railway
  if (IS_PRODUCTION) {
    return RAILWAY_URL;
  }

  const savedPort = localStorage.getItem('backend-port') || '5002';
  return `http://localhost:${savedPort}`;
}

// Solo ejecutar la detección de puerto en desarrollo local
if (!IS_PRODUCTION) {
  detectBackendPort().catch(console.error);
}

export default { detectBackendPort, getWebSocketUrl, getApiBaseUrl };