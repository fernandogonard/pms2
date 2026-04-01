// hooks/useWebSocket.js
// Hook centralizado para WebSocket con reconexión, deduplicación y backoff
import { useEffect, useRef } from 'react';
import { createWS } from '../utils/wsClient';

export const useWebSocket = ({ onMessage, onError, onClose }) => {
  const wsRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = process.env.REACT_APP_WS_URL || `ws://${window.location.hostname}:5001`;

    const client = createWS(`${wsUrl}/ws`, {
      onmessage: (ev) => { if (onMessage) onMessage(ev); },
      onerror: (err) => { if (onError) onError(err.message || 'WebSocket error'); },
      onclose: () => { if (onClose) onClose(); },
    });

    wsRef.current = client;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [onMessage, onError, onClose]);
};
