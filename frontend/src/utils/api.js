// utils/api.js
// Utilidad API con funcionalidad offline para PWA
import { useOfflineRequest, useLocalCache } from '../hooks/useOffline';
import redirectorService from '../services/redirectorService';

// API Base URL dinámica
let API_BASE_URL = '';
let API_PORT_DISCOVERY = false;
let API_PORT_DISCOVERY_INTERVAL = null;
let API_PORT_DISCOVERY_PROMISE = null; // Lock global para evitar llamadas concurrentes

// Función para descubrir el puerto del backend usando redirectorService
export async function discoverBackendPort() {
  // Log de depuración para rastrear llamadas
  if (typeof window !== 'undefined') {
    if (!window.__dbg_port_calls) window.__dbg_port_calls = [];
    window.__dbg_port_calls.push({ ts: Date.now(), stack: new Error().stack });
    if (window.__dbg_port_calls.length > 50) window.__dbg_port_calls.shift();
    console.debug('[discoverBackendPort] llamada', window.__dbg_port_calls.length, 'timestamp', Date.now());
  }
  // Lock global: si ya hay una promesa en curso, reusar
  if (API_PORT_DISCOVERY_PROMISE) {
    console.debug('[discoverBackendPort] Reusando promesa existente');
    return API_PORT_DISCOVERY_PROMISE;
  }
  API_PORT_DISCOVERY_PROMISE = (async () => {
    try {
      // Optimization: Avoid redundant port discovery if already configured
      if (API_BASE_URL) {
        console.log('✅ Backend port already configured:', API_BASE_URL);
        return API_BASE_URL.split(':').pop();
      }

      // Usar el servicio de redirección para obtener el puerto
      const result = await redirectorService.detectBackendPort();
      if (result && result.success && result.port) {
        console.log(`🔍 Backend descubierto en puerto: ${result.port}`);
        API_BASE_URL = `http://localhost:${result.port}`;
        localStorage.setItem('backend-port', result.port.toString());
        return result.port;
      }
      // Si redirectorService falla, intentamos el método anterior como respaldo
      const savedPort = localStorage.getItem('backend-port');
      const portsToTry = savedPort ? [savedPort, '5000', '5001', '5002'] : ['5000', '5001', '5002'];
      for (const port of portsToTry) {
        try {
          const response = await fetch(`http://localhost:${port}/api/system/port`);
          if (response.ok) {
            console.log(`✅ Puerto ${port} confirmado`);
            API_BASE_URL = `http://localhost:${port}`;
            localStorage.setItem('backend-port', port);
            return port;
          }
        } catch (error) {
          console.warn(`⚠️ Puerto ${port} no disponible`);
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
    } finally {
      API_PORT_DISCOVERY_PROMISE = null; // Liberar el bloqueo global
    }
  })();
  return API_PORT_DISCOVERY_PROMISE;
}

// Iniciar descubrimiento automático del puerto
export function startPortDiscovery() {
  if (API_PORT_DISCOVERY) return;
  API_PORT_DISCOVERY = true;
  // Llamar solo una vez y luego programar el intervalo si no existe
  discoverBackendPort();
  if (!API_PORT_DISCOVERY_INTERVAL) {
    API_PORT_DISCOVERY_INTERVAL = setInterval(() => {
      discoverBackendPort();
    }, 300000); // 5 minutos
  }
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
  // Si no hay URL base, intentar descubrirla (protegido por lock)
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

  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(resolvedUrl, final);

      // Manejar respuesta 429 (rate limit)
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
        console.warn(`429 Too Many Requests. Retrying in ${waitTime / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries -= 1;
        continue;
      }

      // Manejar respuesta 401 (sesión expirada)
      if (res.status === 401) {
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
      if (retries <= 1 || opts.method && opts.method !== 'GET') {
        console.error('Request failed:', error);
        throw error;
      }

      const cacheKey = `api-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const cached = localStorage.getItem(`crm-cache-${cacheKey}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.expiry > Date.now()) {
            console.log('Serving from cache:', url);
            return new Response(JSON.stringify(parsed.data), { status: 200 });
          }
        } catch (cacheError) {
          console.warn('Error reading cache:', cacheError);
        }
      }

      retries -= 1;
    }
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



export default apiFetch;
