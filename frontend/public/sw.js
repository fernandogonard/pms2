// Service Worker para CRM Hotelero PWA
// Versión 2.0.1 - Correcciones aplicadas para hot-update y cache

const CACHE_NAME = 'crm-hotelero-v2.0.2';
const STATIC_CACHE = 'crm-hotelero-static-v2.0.2';
const API_CACHE = 'crm-hotelero-api-v2.0.2';

// Recursos críticos que siempre deben estar en cache
const CRITICAL_RESOURCES = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-16x16.png',
  '/icons/icon-72x72.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// API endpoints que pueden funcionar offline
const API_ENDPOINTS = [
  '/api/auth/profile',
  '/api/rooms',
  '/api/rooms/available',
  '/api/rooms/status',
  '/api/reservations',
  '/api/clients'
];

// Páginas que pueden funcionar offline
const OFFLINE_PAGES = [
  '/',
  '/login',
  '/reception',
  '/admin',
  '/reception/rooms',
  '/reception/reservations',
  '/admin/dashboard'
];

// Configuración de cache
const CACHE_CONFIG = {
  staticMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  apiMaxAge: 5 * 60 * 1000, // 5 minutos
  maxEntries: 100
};

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v2.0.0');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Cache abierto, guardando recursos críticos');
        return cache.addAll(CRITICAL_RESOURCES);
      })
      .then(() => {
        console.log('[SW] Recursos críticos cacheados exitosamente');
        return self.skipWaiting(); // Forzar activación inmediata
      })
      .catch(error => {
        console.error('[SW] Error al cachear recursos críticos:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker v2.0.0');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Eliminar caches viejos
            if (cacheName.includes('crm-hotelero') && 
                cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[SW] Eliminando cache obsoleto:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activado y controlando páginas');
        return self.clients.claim(); // Controlar páginas inmediatamente
      })
  );
});

// Interceptar requests
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Ignorar requests no HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // NO interceptar requests a dominios externos (Railway, CDN con credenciales, etc.)
  // Dejarlos pasar directamente para preservar headers Authorization
  if (url.origin !== location.origin) {
    return;
  }
  
  // IMPORTANTE: No cachear peticiones POST
  if (request.method === 'POST') {
    return;
  }
  
  // Estrategia para API calls same-origin (solo GET) — pasa por Vercel proxy a Railway
  if (url.pathname.startsWith('/api/') && request.method === 'GET') {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Estrategia para recursos estáticos
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      url.hostname !== location.hostname) {
    event.respondWith(handleStaticResource(request));
    return;
  }
  
  // Estrategia para páginas HTML
  if (request.mode === 'navigate') {
    event.respondWith(handlePageRequest(request));
    return;
  }
  
  // Default: Network first (solo GET)
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});

// Manejar requests de API - Network First con fallback (solo para GET)
async function handleApiRequest(request) {
  // Asegurarse de que solo procesamos peticiones GET
  if (request.method !== 'GET') {
    return fetch(request);
  }

  const cache = await caches.open(API_CACHE);
  
  try {
    // Intentar network primero
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.ok) {
      try {
        // Cachear respuesta exitosa (solo para GET)
        const responseClone = networkResponse.clone();
        
        // Usar Promise.catch para manejar errores de cache sin interrumpir
        cache.put(request, responseClone)
          .catch(err => console.log('[SW] Error caching API response:', request.url, err));
        
        // Notificar que hay datos nuevos
        broadcastUpdate('api-update', {
          url: request.url,
          timestamp: new Date().toISOString()
        });
      } catch (cacheError) {
        console.log('[SW] Error preparing API response for cache:', cacheError);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for API, trying cache:', request.url);
    
    // Fallback a cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Notificar que se está usando cache
      broadcastUpdate('offline-mode', {
        url: request.url,
        message: 'Mostrando datos offline'
      });
      return cachedResponse;
    }
    
    // Si no hay cache, retornar respuesta offline
    return createOfflineApiResponse(request);
  }
}

// Manejar recursos estáticos - Cache First
async function handleStaticResource(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Verificar si el cache es reciente
    const cacheTime = new Date(cachedResponse.headers.get('sw-cache-time') || 0);
    const now = new Date();
    
    if (now - cacheTime < CACHE_CONFIG.staticMaxAge) {
      return cachedResponse;
    }
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      try {
        // Crear clon antes de manipular respuesta
        const responseClone = networkResponse.clone();
        // Crear un objeto con headers y timestamp
        const headers = new Headers(responseClone.headers);
        headers.set('sw-cache-time', new Date().toISOString());
        
        // Crear una nueva respuesta con el timestamp
        const responseWithTime = new Response(responseClone.body, {
          status: responseClone.status,
          statusText: responseClone.statusText,
          headers
        });
        
        // Guardar en cache con manejo de errores
        cache.put(request, responseWithTime)
          .catch(err => console.log('[SW] Error caching static resource:', request.url, err));
      } catch (cacheError) {
        console.log('[SW] Error preparing response for cache:', cacheError);
      }
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network error for static resource:', request.url, error);
    return cachedResponse || createOfflineResponse();
  }
}

// Manejar páginas HTML - Network First con SPA fallback
async function handlePageRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      try {
        const cache = await caches.open(CACHE_NAME);
        
        // Usar .catch para manejar errores de cache sin interrumpir
        cache.put(request, networkResponse.clone())
          .catch(err => console.log('[SW] Error caching page:', request.url, err));
      } catch (cacheError) {
        console.log('[SW] Error preparing page for cache:', cacheError);
      }
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for page, trying cache or SPA fallback');
    
    // Intentar cache primero
    try {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Fallback a la SPA principal para rutas de React
      const cache = await caches.open(STATIC_CACHE);
      const appShell = await cache.match('/');
      if (appShell) {
        return appShell;
      }
    } catch (cacheError) {
      console.log('[SW] Error fetching from cache:', cacheError);
    }
    
    return createOfflineResponse();
  }
}

// Crear respuesta offline para API
function createOfflineApiResponse(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  let offlineData = { 
    error: 'Sin conexión',
    offline: true,
    message: 'Datos no disponibles offline'
  };
  
  // Datos mock para diferentes endpoints
  if (pathname.includes('/rooms')) {
    offlineData = {
      success: true,
      offline: true,
      rooms: [],
      message: 'Datos de habitaciones no disponibles offline'
    };
  } else if (pathname.includes('/reservations')) {
    offlineData = {
      success: true,
      offline: true,
      reservations: [],
      message: 'Reservas no disponibles offline'
    };
  }
  
  return new Response(JSON.stringify(offlineData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Response': 'true'
    }
  });
}

// Crear respuesta offline genérica
function createOfflineResponse() {
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sin Conexión - CRM Hotelero</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
          }
          .container {
            background: rgba(255,255,255,0.1);
            padding: 2rem;
            border-radius: 15px;
            backdrop-filter: blur(10px);
          }
          h1 { margin-bottom: 1rem; }
          p { margin-bottom: 1.5rem; line-height: 1.6; }
          button {
            background: rgba(255,255,255,0.2);
            border: 2px solid rgba(255,255,255,0.3);
            padding: 12px 24px;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
          }
          button:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🌐 Sin Conexión</h1>
          <p>No hay conexión a internet disponible.<br>
          Algunas funcionalidades pueden estar limitadas.</p>
          <button onclick="window.location.reload()">
            🔄 Reintentar Conexión
          </button>
        </div>
        <script>
          // Recargar cuando vuelva la conexión
          window.addEventListener('online', () => {
            window.location.reload();
          });
        </script>
      </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

// Broadcast de actualizaciones a los clientes
function broadcastUpdate(type, data) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: type,
        data: data,
        timestamp: new Date().toISOString()
      });
    });
  });
}

// Sincronización en background
self.addEventListener('sync', event => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'background-sync-reservations') {
    event.waitUntil(syncPendingReservations());
  }
  
  if (event.tag === 'background-sync-updates') {
    event.waitUntil(syncPendingUpdates());
  }
});

// Sincronizar reservas pendientes
async function syncPendingReservations() {
  try {
    const pendingReservations = await getStoredData('pending-reservations');
    
    for (const reservation of pendingReservations) {
      try {
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${reservation.token}`
          },
          body: JSON.stringify(reservation.data)
        });
        
        if (response.ok) {
          await removeStoredData('pending-reservations', reservation.id);
          broadcastUpdate('sync-success', {
            type: 'reservation',
            id: reservation.id,
            message: 'Reserva sincronizada exitosamente'
          });
        }
      } catch (error) {
        console.error('[SW] Error syncing reservation:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in background sync:', error);
  }
}

// Sincronizar actualizaciones pendientes
async function syncPendingUpdates() {
  try {
    // Intentar actualizar cache de API críticos
    const criticalAPIs = ['/api/rooms', '/api/reservations/today'];
    
    for (const endpoint of criticalAPIs) {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          const cache = await caches.open(API_CACHE);
          await cache.put(endpoint, response.clone());
        }
      } catch (error) {
        console.log('[SW] Could not update cache for:', endpoint);
      }
    }
    
    broadcastUpdate('cache-updated', {
      message: 'Cache actualizado en background'
    });
  } catch (error) {
    console.error('[SW] Error in background cache update:', error);
  }
}

// Notificaciones Push
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'Nueva reserva recibida',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: 'hotel-notification',
    data: {
      url: '/reception/reservations'
    },
    actions: [
      {
        action: 'view',
        title: 'Ver Reserva',
        icon: '/icons/action-view.png'
      },
      {
        action: 'dismiss',
        title: 'Cerrar',
        icon: '/icons/action-close.png'
      }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };
  
  if (event.data) {
    const data = event.data.json();
    options.body = data.message || options.body;
    options.data = { ...options.data, ...data };
  }
  
  event.waitUntil(
    self.registration.showNotification('CRM Hotelero', options)
  );
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  if (event.action === 'view') {
    const url = event.notification.data?.url || '/';
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});

// Funciones de almacenamiento local
async function getStoredData(key) {
  try {
    const cache = await caches.open('local-storage');
    const response = await cache.match(`/local-storage/${key}`);
    if (response) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('[SW] Error getting stored data:', error);
    return [];
  }
}

async function removeStoredData(key, id) {
  try {
    const data = await getStoredData(key);
    const filteredData = data.filter(item => item.id !== id);
    
    const cache = await caches.open('local-storage');
    await cache.put(`/local-storage/${key}`, 
      new Response(JSON.stringify(filteredData), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch (error) {
    console.error('[SW] Error removing stored data:', error);
  }
}

console.log('[SW] Service Worker v2.0.0 cargado exitosamente');