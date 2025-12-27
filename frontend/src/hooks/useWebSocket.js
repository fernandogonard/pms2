// hooks/useWebSocket.js
// Hook centralizado para WebSocket con reconexión, deduplicación y backoff
import { useEffect, useRef, useState } from 'react';
import { createWS } from '../utils/wsClient';

const defaultOptions = {
  onOpen: () => {},
  onClose: () => {},
  onError: () => {},
  onMessage: () => false,
  reconnect: true,
  dedupeWindow: 500,
  enabled: true
};

/**
 * Hook para manejar WebSocket con reconexión automática y deduplicación
 * @param {Object} options - Configuración del WebSocket
 * @param {Function} options.onMessage - Callback para mensajes (debe retornar true si consume el evento)
 * @param {Function} options.onOpen - Callback cuando se abre la conexión
 * @param {Function} options.onClose - Callback cuando se cierra la conexión
 * @param {Function} options.onError - Callback para errores
 * @param {number} options.dedupeWindow - Ventana de deduplicación en ms (default: 500)
 * @returns {Object} - { wsError, isConnected }
 */
export default function useWebSocket(options = {}) {
  const config = { ...defaultOptions, ...options };
  const [wsError, setWsError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const lastHandled = useRef({});
  const wsRef = useRef(null);

  useEffect(() => {
    if (!config.enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setWsError(null);
      return undefined;
    }

    // Construir URL del WebSocket
    const redirectorService = require('../services/redirectorService');
    
    const buildWsUrl = () => {
      const wsUrl = redirectorService.getWebSocketUrl();
      if (wsUrl) return wsUrl;
      
      const wsEnv = process.env.REACT_APP_WS_URL && process.env.REACT_APP_WS_URL.trim();
      if (wsEnv) return wsEnv;
      
      const apiEnv = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim();
      if (apiEnv) {
        const wsUrl = apiEnv.replace(/^http/, 'ws');
        return `${wsUrl.replace(/\/$/, '')}/ws`;
      }
      
      // En desarrollo con frontend en 3000, siempre usar el puerto del backend desde localStorage
      const savedPort = typeof window !== 'undefined' ? localStorage.getItem('backend-port') : null;
      const backendPort = savedPort || '5000';
      
      return `ws://localhost:${backendPort}/ws`;
    };

    const wsUrl = buildWsUrl();
    
    wsRef.current = createWS(wsUrl, {
      onopen(event) {
        setIsConnected(true);
        setWsError(null);
        config.onOpen(event);
      },
      onmessage(event) {
        const payload = safelyParse(event.data);
        if (!payload) return;
        
        // Deduplicación basada en tipo de evento
        const now = Date.now();
        const key = `${payload.type}-${payload.reservationId || payload.roomId || ''}`;
        const lastTs = lastHandled.current[key] || 0;
        
        if (now - lastTs < config.dedupeWindow) {
          // Evento duplicado, ignorar
          return;
        }
        
        lastHandled.current[key] = now;
        
        // Intentar consumir el evento
        const consumed = config.onMessage(payload);
        
        // Si el evento no fue consumido y es importante, reportar
        if (!consumed && payload.type?.startsWith('reservation_')) {
          console.warn('[useWebSocket] Evento no consumido:', payload.type);
        }
      },
      onclose(event) {
        setIsConnected(false);
        setWsError('Conexión cerrada');
        config.onClose(event);
      },
      onerror(event) {
        setWsError('Error en WebSocket');
        setIsConnected(false);
        config.onError(event);
      }
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [config.onMessage, config.onOpen, config.onClose, config.onError, config.dedupeWindow, config.enabled]);

  return { wsError, isConnected };
}

/**
 * Parsea JSON de forma segura
 */
function safelyParse(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}
