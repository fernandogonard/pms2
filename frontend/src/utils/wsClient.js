// utils/wsClient.js
// Pequeño cliente WebSocket con reconexión exponencial y API simple
import redirectorService from '../services/redirectorService';

export function createWS(urlParam, handlers = {}) {
  let ws = null;
  let attempts = 0;
  let closedByUser = false;
  const maxDelay = 30000;
  let heartbeatTimer = null;
  let lastPong = Date.now();
  let url = urlParam;
  let isPortDiscoveryActive = false;
  
  // Al principio, intentar descubrir el puerto actual del servidor
  discoverServerPort();

  const { onopen, onmessage, onclose, onerror } = handlers;
  
  // Función para descubrir el puerto actual del backend
  async function discoverServerPort() {
    if (isPortDiscoveryActive) return; // Evitar múltiples solicitudes paralelas
    
    isPortDiscoveryActive = true;
    try {
      // Primero intentar con redirectorService
      try {
        // Obtener la URL del WebSocket desde redirectorService
        const wsUrl = redirectorService.getWebSocketUrl();
        if (wsUrl) {
          console.log(`[WS] Puerto descubierto mediante redirectorService: ${wsUrl}`);
          url = wsUrl; // Actualizar la URL con el endpoint correcto
          
          // Si ya hay un intento de conexión en curso, cerrar y reconectar
          if (ws && ws.readyState !== WebSocket.CLOSED) {
            try { ws.close(); } catch (e) {}
          }
          return;
        }
      } catch (redirErr) {
        console.warn('[WS] Error con redirectorService, probando método alternativo');
      }
      
      // Si redirectorService falla, intentar con el método anterior
      const response = await fetch('/api/system/port');
      if (!response.ok) throw new Error('Error al obtener información del puerto');
      
      const data = await response.json();
      if (data.success && data.wsEndpoint) {
        console.log(`[WS] Puerto descubierto: ${data.port}, Endpoint: ${data.wsEndpoint}`);
        url = data.wsEndpoint; // Actualizar la URL con el endpoint correcto
        
        // Si ya hay un intento de conexión en curso, cerrar y reconectar
        if (ws && ws.readyState !== WebSocket.CLOSED) {
          try { ws.close(); } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('[WS] Error al descubrir puerto:', err && err.message);
      // Seguir usando la URL original en caso de error
    } finally {
      isPortDiscoveryActive = false;
    }
  }

  function getUrlWithToken() {
    try {
      const token = localStorage.getItem('token');
      // Log ligero: token presente o no (no imprimir token en claro)
      const hasToken = !!token;
      try { console.log(`[WS] construir URL. base=${url} tokenPresent=${hasToken}`); } catch (e) {}
      if (!token) return url;
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}token=${encodeURIComponent(token)}`;
    } catch (e) { return url; }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      try {
        // enviar ping de aplicación; el servidor responderá con {type:'pong'}
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      } catch (e) {}
      // si no hemos recibido pong en 60s, forzamos cierre para reintentar
      if (Date.now() - lastPong > 60000) {
        try { ws && ws.close(); } catch (e) {}
      }
    }, 20000);
  }
  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  function connect() {
    if (closedByUser) return; // No reconectar si fue cerrado por el usuario
    
    // Intentar obtener la URL WebSocket optimizada desde el redirectorService
    try {
      const redirectedWsUrl = redirectorService.getWebSocketUrl();
      if (redirectedWsUrl) {
        url = redirectedWsUrl;
        console.log(`[WS] Usando URL de redirectorService: ${url}`);
      } else {
        // Fallback al método anterior si redirectorService no devuelve una URL
        const savedPort = localStorage.getItem('backend-port');
        if (savedPort && !url.includes(`:${savedPort}/`)) {
          const baseUrl = url.split('/ws')[0]; // Obtener base URL sin el path ws
          const wsBase = baseUrl.includes('://') ? baseUrl.split('://')[1] : baseUrl;
          const host = wsBase.split(':')[0] || 'localhost';
          url = `ws://${host}:${savedPort}/ws`;
          console.log(`[WS] Usando puerto guardado en localStorage: ${savedPort}`);
        }
      }
    } catch (e) {
      console.warn('[WS] Error al obtener URL optimizada:', e);
    }
    
    try {
      const resolved = getUrlWithToken();
      // Solo log en desarrollo
      if (process.env.NODE_ENV === 'development') {
        try { console.log(`[WS] conectando a: ${resolved}`); } catch (e) {}
      }
      ws = new window.WebSocket(resolved);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        try { console.log('[WS] error al crear WebSocket:', err && err.message); } catch (e) {}
      }
      onerror && onerror(err);
      scheduleReconnect();
      return;
    }

    ws.onopen = (ev) => {
      attempts = 0;
      lastPong = Date.now();
      startHeartbeat();
      onopen && onopen(ev);
    };

    ws.onmessage = (ev) => {
      try {
        const data = ev.data && ev.data.toString ? ev.data.toString() : ev.data;
        // responder a pings y actualizar lastPong si viene pong
        try {
          const j = JSON.parse(data);
          if (j && j.type === 'pong') {
            lastPong = Date.now();
          } else if (j && j.type === 'ping') {
            // responder pong de aplicación
            try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) {}
          }
        } catch (e) {}
      } catch (e) {}
      onmessage && onmessage(ev);
    };

    ws.onclose = (ev) => {
      stopHeartbeat();
      onclose && onclose(ev);
      if (!closedByUser) scheduleReconnect();
    };

    ws.onerror = (ev) => {
      if (process.env.NODE_ENV === 'development') {
        try { console.log('[WS] evento error', ev && ev.message ? ev.message : ev); } catch (e) {}
      }
      onerror && onerror(ev);
      // No cerrar manualmente, dejar que onclose maneje la reconexión
    };
  }

  function scheduleReconnect() {
    attempts++;
    // Si llevamos 3 o más intentos, intentar redescubrir el puerto
    if (attempts >= 3 && attempts % 3 === 0) {
      discoverServerPort();
    }
    
    const delay = Math.min(maxDelay, 1000 * Math.pow(2, Math.min(attempts, 5)));
    setTimeout(() => {
      if (!closedByUser) connect();
    }, delay);
  }

  // iniciar conexión después de un breve retraso para dar tiempo a la detección de puerto
  setTimeout(() => {
    if (!closedByUser) connect();
  }, 300);

  return {
    close() {
      closedByUser = true;
      stopHeartbeat();
      try { ws && ws.close(); } catch (e) {}
    },
    send(data) {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
      } catch (e) {
        // ignore send errors
      }
    }
  };
}
