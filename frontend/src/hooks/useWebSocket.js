// hooks/useWebSocket.js
// Hook centralizado para WebSocket com reconexão, deduplicação e backoff
import { useEffect, useRef } from 'react';
import WSClient from '../utils/wsClient';

export const useWebSocket = ({ onMessage, onError, onClose }) => {
  const wsClientRef = useRef(null);
  const messageHandlerRef = useRef(null);
  const errorHandlerRef = useRef(null);
  const closeHandlerRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token'); // Assuming token is stored here
    if (!token) return;

    if (!wsClientRef.current) {
      wsClientRef.current = new WSClient(process.env.REACT_APP_WS_URL);
    }

    messageHandlerRef.current = (data) => {
      if (onMessage) onMessage(data);
    };

    errorHandlerRef.current = (error) => {
      if (onError) onError(error.message);
    };

    closeHandlerRef.current = () => {
      if (onClose) onClose();
    };

    wsClientRef.current.addListener(messageHandlerRef.current);
    wsClientRef.current.connect(token);

    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.removeListener(messageHandlerRef.current);
      }
    };
  }, [onMessage, onError, onClose]);

  useEffect(() => {
    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
      }
    };
  }, []);
};
