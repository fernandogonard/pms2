import { useEffect, useState, useRef } from 'react';
import { discoverBackendPort } from '../utils/api';

/**
 * Hook global para asegurar que el backend esté listo antes de hacer llamadas API.
 * Devuelve { backendReady, backendLoading, backendError }
 */
export default function useBackendReady() {
  const [backendReady, setBackendReady] = useState(false);
  const [backendLoading, setBackendLoading] = useState(true);
  const [backendError, setBackendError] = useState('');
  const retryCount = useRef(0);
  const timeoutRef = useRef(null);
  const maxRetries = 5;
  const baseDelay = 1000; // 1 segundo

  useEffect(() => {
    let cancelled = false;
    setBackendLoading(true);
    setBackendError('');
    setBackendReady(false);
    retryCount.current = 0;

    function tryDiscover() {
      discoverBackendPort()
        .then(port => {
          if (cancelled) return;
          if (port) {
            setBackendReady(true);
            setBackendLoading(false);
            setBackendError('');
          } else {
            handleRetry();
          }
        })
        .catch(() => {
          if (cancelled) return;
          handleRetry();
        });
    }

    function handleRetry() {
      retryCount.current += 1;
      if (retryCount.current > maxRetries) {
        setBackendError('No se pudo conectar con el backend.');
        setBackendLoading(false);
        return;
      }
      // Backoff exponencial simple: baseDelay * 2^(n-1)
      const delay = baseDelay * Math.pow(2, retryCount.current - 1);
      timeoutRef.current = setTimeout(() => {
        if (!cancelled) tryDiscover();
      }, delay);
    }

    tryDiscover();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { backendReady, backendLoading, backendError };
}
