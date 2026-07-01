// hooks/useWebSocket.js
// Hook centralizado para WebSocket con reconexión, deduplicación y backoff
import { useEffect, useRef } from 'react';
import { createWS } from '../utils/wsClient';
import { getAccessToken } from '../utils/api';
import { getAppMode } from '../config/appMode';

export const useWebSocket = ({ onMessage, onError, onClose }) => {
  const wsRef = useRef(null);
  const appModeRef = useRef(getAppMode());
  const callbacksRef = useRef({ onMessage, onError, onClose });
  callbacksRef.current = { onMessage, onError, onClose };

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const wsUrl = process.env.REACT_APP_WS_URL || `ws://${window.location.hostname}:5001`;

    const client = createWS(`${wsUrl}/ws`, {
      onmessage: (ev) => {
        try {
          const raw = ev.data && ev.data.toString ? ev.data.toString() : ev.data;
          const parsed = JSON.parse(raw);
          if (parsed.type === 'ping' || parsed.type === 'pong') return;

          // Si el backend informa mode, descartamos mensajes de otro entorno funcional.
          if (parsed.mode && parsed.mode !== appModeRef.current) return;

          callbacksRef.current.onMessage?.(parsed);
        } catch (e) {
          // Si no es JSON válido, pasar como string
          callbacksRef.current.onMessage?.({ type: 'raw', data: ev.data });
        }
      },
      onerror: (err) => { callbacksRef.current.onError?.(err.message || 'WebSocket error'); },
      onclose: () => { callbacksRef.current.onClose?.(); },
    });

    wsRef.current = client;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // solo se crea una vez al montar
};
