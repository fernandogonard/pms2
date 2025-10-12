// utils/api.js
// Utilidad API con funcionalidad offline para PWA
import { useOfflineRequest, useLocalCache } from '../hooks/useOffline';
import redirectorService from '../services/redirectorService';

// API Base URL dinámica
let API_BASE_URL = '';
let API_PORT_DISCOVERY = false;
let API_PORT_DISCOVERY_INTERVAL = null;

// Función para descubrir el puerto del backend usando redirectorService
export async function discoverBackendPort() {
  try {
    // Usar el servicio de redirección para obtener el puerto
    const result = await redirectorService.detectBackendPort();
    
    if (result && result.success && result.port) {
      console.log(`🔍 Backend descubierto en puerto: ${result.port}`);
      API_BASE_URL = `http://localhost:${result.port}`;
      localStorage.setItem('backend-port', result.port.toString());
      return result.port;
    }
    
    // Si redirectorService falla, intentamos el método anterior como respaldo
    // Intentar múltiples puertos comunes si no hay uno guardado
    const savedPort = localStorage.getItem('backend-port');
    const portsToTry = savedPort ? [savedPort, '5002', '5001', '5000'] : ['5002', '5001', '5000'];
    
    for (const port of portsToTry) {
      try {
        const res = await fetch(`http://localhost:${port}/api/system/port`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.port) {
            console.log(`🔍 Backend descubierto en puerto: ${data.port}`);
            API_BASE_URL = `http://localhost:${data.port}`;
            localStorage.setItem('backend-port', data.port.toString());
            return data.port;
          }
        }
      } catch (e) {
        // Ignorar errores individuales y continuar con el siguiente puerto
      }
    }
    
    // Si no se encontró ningún puerto válido, volver al valor por defecto o guardado
    const defaultPort = savedPort || '5002';
    API_BASE_URL = `http://localhost:${defaultPort}`;
    console.warn(`⚠️ No se pudo descubrir el puerto del backend. Usando puerto por defecto: ${defaultPort}`);
    return defaultPort;
    
  } catch (error) {
    console.error('❌ Error al intentar descubrir el puerto del backend:', error);
    return null;
  }
}

// Iniciar descubrimiento automático del puerto
export function startPortDiscovery() {
  if (API_PORT_DISCOVERY) return;
  
  API_PORT_DISCOVERY = true;
  discoverBackendPort();
  
  // Programar redescubrimiento cada 5 minutos
  API_PORT_DISCOVERY_INTERVAL = setInterval(() => {
    discoverBackendPort();
  }, 300000); // 5 minutos
  
  return () => {
    if (API_PORT_DISCOVERY_INTERVAL) {
      clearInterval(API_PORT_DISCOVERY_INTERVAL);
      API_PORT_DISCOVERY_INTERVAL = null;
    }
    API_PORT_DISCOVERY = false;
  };
}

// Función principal de API con soporte offline
export async function apiFetch(url, opts = {}) {
  // Si no hay URL base, intentar descubrirla
  if (!API_BASE_URL && !API_PORT_DISCOVERY) {
    await discoverBackendPort();
  }
  
  // Resolver URL relativa contra API_BASE_URL o redirectorService o REACT_APP_API_URL
  const API_BASE = API_BASE_URL || 
    redirectorService.getApiBaseUrl() ||
    (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || '';
  const resolvedUrl = API_BASE && !/^https?:\/\//i.test(url) ? 
    `${API_BASE.replace(/\/$/, '')}/${url.replace(/^\//, '')}` : url;
  const token = localStorage.getItem('token');
  
  // Construir headers a partir de opts.headers y añadir Authorization si procede.
  const headers = Object.assign({}, opts.headers || {});
  if (token && !headers.Authorization && !headers.authorization) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // No sobrescribir los headers ya construidos cuando se mezclen las opciones.
  const final = Object.assign({}, opts);
  if (!final.credentials) final.credentials = 'include';
  final.headers = headers;

  try {
    const res = await fetch(resolvedUrl, final);
    
    // Manejar respuesta 401 (sesión expirada)
    if (res.status === 401) {
      // sesión inválida/expirada: limpiar token y emitir evento global para UI
      try { localStorage.removeItem('token'); } catch (e) {}
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.dispatchEvent(new CustomEvent('sessionExpired', { detail: { next } }));
      }
      const err = new Error('Unauthorized');
      err.response = res;
      throw err;
    }

    // Cachear respuestas exitosas GET automáticamente
    if (res.ok && (!opts.method || opts.method === 'GET')) {
      try {
        const responseData = await res.clone().json();
        const cacheKey = `api-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const cacheData = {
          data: responseData,
          expiry: Date.now() + (5 * 60 * 1000), // 5 minutos
          timestamp: new Date().toISOString(),
          url: resolvedUrl
        };
        localStorage.setItem(`crm-cache-${cacheKey}`, JSON.stringify(cacheData));
      } catch (error) {
        console.warn('Error caching response:', error);
      }
    }

    return res;
  } catch (error) {
    // Si falla la request y es GET, intentar servir desde cache
    if (!opts.method || opts.method === 'GET') {
      const cacheKey = `api-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const cached = localStorage.getItem(`crm-cache-${cacheKey}`);
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.expiry > Date.now()) {
            console.log('Serving from cache:', url);
            
            // Incrementar contador de cache hits
            const hits = parseInt(localStorage.getItem('cache-hits') || '0') + 1;
            localStorage.setItem('cache-hits', hits.toString());
            
            // Crear respuesta mock desde cache
            return new Response(JSON.stringify(parsed.data), {
              status: 200,
              headers: { 
                'Content-Type': 'application/json',
                'X-Offline-Response': 'true',
                'X-Cache-Time': parsed.timestamp
              }
            });
          }
        } catch (parseError) {
          console.warn('Error parsing cached data:', parseError);
        }
      }
    }

    // Incrementar contador de cache misses
    const misses = parseInt(localStorage.getItem('cache-misses') || '0') + 1;
    localStorage.setItem('cache-misses', misses.toString());

    throw error;
  }
}

// Función para limpiar reservas fantasma
export async function cleanupGhostReservations() {
  const res = await apiFetch('/api/reservations/cleanup-ghost', {
    method: 'POST'
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Error al limpiar reservas fantasma');
  }
  return res.json();
}

// Iniciar descubrimiento de puerto automáticamente
startPortDiscovery();

export default apiFetch;
