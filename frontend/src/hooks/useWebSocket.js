// hooks/useWebSocket.js
// Hook centralizado para WebSocket con reconexión, deduplicación y backoff
import { useEffect, useRef } from 'react';
import { createWS } from '../utils/wsClient';

export const useWebSocket = ({ onMessage, onError, onClose }) => {
  const wsRef = useRef(null);
  const callbacksRef = useRef({ onMessage, onError, onClose });
  callbacksRef.current = { onMessage, onError, onClose };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = process.env.REACT_APP_WS_URL || `ws://${window.location.hostname}:5001`;

    const client = createWS(`${wsUrl}/ws`, {
      onmessage: (ev) => { callbacksRef.current.onMessage?.(ev); },
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
