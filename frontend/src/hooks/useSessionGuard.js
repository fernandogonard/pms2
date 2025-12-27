// hooks/useSessionGuard.js
// Hook centralizado para saber si la sesión está lista antes de disparar fetchs
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SESSION_EXPIRED_MESSAGE = 'sessionExpired';

export default function useSessionGuard(options = {}) {
  const { requireAuth = true } = options;
  const { isAuthenticated, loading } = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);

  // Escuchar evento global emitido por apiFetch ante un 401
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleSessionExpired = () => setSessionExpired(true);
    window.addEventListener(SESSION_EXPIRED_MESSAGE, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_MESSAGE, handleSessionExpired);
    };
  }, []);

  // Si el usuario vuelve a autenticarse limpiamos el flag
  useEffect(() => {
    if (isAuthenticated) {
      setSessionExpired(false);
    }
  }, [isAuthenticated]);

  const canFetch = useMemo(() => {
    if (loading) return false;
    if (sessionExpired) return false;
    if (!requireAuth) return true;
    return !!isAuthenticated;
  }, [isAuthenticated, loading, requireAuth, sessionExpired]);

  return {
    canFetch,
    sessionExpired,
    authLoading: loading,
    isAuthenticated,
  };
}
