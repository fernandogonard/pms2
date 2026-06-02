// hooks/useReceptionReservations.js
// Hook para datos del panel de recepción con cache
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import useSessionGuard from './useSessionGuard';

const CACHE_DURATION = 30000; // 30 segundos

/**
 * Hook para cargar datos del panel de recepción
 * @returns {Object} - { data, loading, error, refetch }
 */
export default function useReceptionReservations() {
  const [data, setData] = useState({ reservations: [], rooms: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef({ data: null, timestamp: 0 });
  const abortControllerRef = useRef(null);
  const fetchInProgressRef = useRef(false);
  const { canFetch, sessionExpired, authLoading } = useSessionGuard();

  const fetchData = useCallback(async (force = false) => {
    if (!canFetch) {
      return;
    }

    // Abortar fetch anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Verificar cache
    const now = Date.now();
    const cached = cacheRef.current;
    
    if (!force && cached.data && (now - cached.timestamp) < CACHE_DURATION) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // Evitar múltiples llamadas simultáneas
    if (fetchInProgressRef.current && !force) {
      return;
    }

    fetchInProgressRef.current = true;
    setLoading(true);
    setError(null);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const [reservationsRes, roomsRes, usersRes] = await Promise.all([
        apiFetch('/api/reservations', { signal }),
        apiFetch('/api/rooms', { signal }),
        apiFetch('/api/users', { signal })
      ]);

      if (signal.aborted) return;

      const reservationsData = await reservationsRes.json();
      const roomsData = await roomsRes.json();
      const usersData = await usersRes.json();

      const result = {
        reservations: Array.isArray(reservationsData) ? reservationsData : (reservationsData?.data || []),
        rooms: Array.isArray(roomsData) ? roomsData : [],
        users: Array.isArray(usersData) ? usersData : [],
        timestamp: now
      };

      cacheRef.current = {
        data: result,
        timestamp: now
      };

      setData(result);
      setLoading(false);
    } catch (err) {
      if (err.name === 'AbortError') return;
      
      console.error('Error loading reception data:', err);
      setError(err.message || 'No se pudieron cargar los datos.');
      setLoading(false);
    } finally {
      fetchInProgressRef.current = false;
    }
  }, []);

  const refetch = useCallback((options = {}) => {
    if (!canFetch) {
      return;
    }
    fetchData(options.force !== false);
  }, [fetchData, canFetch]);

  useEffect(() => {
    if (sessionExpired) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cacheRef.current = { data: null, timestamp: 0 };
      setLoading(false);
      setData({ reservations: [], rooms: [], users: [] });
      setError('Tu sesión expiró. Inicia sesión nuevamente para ver las reservas.');
    }
  }, [sessionExpired]);

  useEffect(() => {
    if (!canFetch) {
      if (authLoading) {
        setLoading(true);
      } else if (!sessionExpired) {
        setLoading(false);
      }
      return undefined;
    }

    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [canFetch, authLoading, sessionExpired, fetchData]);

  return { data, loading, error, refetch };
}
