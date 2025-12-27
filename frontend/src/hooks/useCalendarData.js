// hooks/useCalendarData.js
// Hook para manejar datos del calendario con cache y debounce
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import useSessionGuard from './useSessionGuard';

const CACHE_DURATION = 30000; // 30 segundos

/**
 * Hook para cargar datos del calendario con cache inteligente
 * @param {number} days - Número de días a cargar (default: 14)
 * @returns {Object} - { data, loading, error, refresh }
 */
export default function useCalendarData(days = 14) {
  const [data, setData] = useState(null);
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

    // Si ya hay un fetch en progreso, abortar el anterior
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

    // Evitar llamadas múltiples simultáneas
    if (fetchInProgressRef.current && !force) {
      return;
    }

    fetchInProgressRef.current = true;
    setLoading(true);
    setError(null);

    // Crear nuevo AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const startDateStr = startDate.toISOString().slice(0, 10);

      const [roomsStatusRes, reservationsRes] = await Promise.all([
        apiFetch(`/api/rooms/status?start=${startDateStr}&days=${days}`, { signal }),
        apiFetch('/api/reservations', { signal })
      ]);

      if (signal.aborted) return;

      const statusData = await roomsStatusRes.json();
      const reservationsData = await (reservationsRes.ok ? reservationsRes.json() : []);

      const result = {
        rooms: statusData.rooms || [],
        overbooked: statusData.overbooked || {},
        assignments: statusData.assignments || {},
        reservations: Array.isArray(reservationsData) ? reservationsData : [],
        days: generateDays(startDate, days),
        timestamp: now
      };

      // Actualizar cache
      cacheRef.current = {
        data: result,
        timestamp: now
      };

      setData(result);
      setLoading(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        // Fetch abortado, ignorar
        return;
      }
      
      console.error('Error loading calendar data:', err);
      setError(err.message || 'Error al cargar el calendario');
      setLoading(false);
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [canFetch, days]);

  const refresh = useCallback((force = false) => {
    if (!canFetch) {
      return;
    }
    fetchData(true);
  }, [fetchData, canFetch]);

  useEffect(() => {
    const handleExternalUpdate = () => {
      refresh(true); // Invalidar cache inmediatamente
    };

    window.addEventListener('calendarUpdate', handleExternalUpdate);

    return () => {
      window.removeEventListener('calendarUpdate', handleExternalUpdate);
    };
  }, [refresh]);

  useEffect(() => {
    if (!canFetch) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      fetchInProgressRef.current = false;
      if (authLoading) {
        setLoading(true);
        setError(null);
      } else if (!sessionExpired) {
        setLoading(false);
        cacheRef.current = { data: null, timestamp: 0 };
        setData(null);
        setError(null);
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

  useEffect(() => {
    if (!sessionExpired) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    fetchInProgressRef.current = false;
    cacheRef.current = { data: null, timestamp: 0 };
    setData(null);
    setLoading(false);
    setError('Tu sesión expiró. Inicia sesión nuevamente para ver el calendario.');
  }, [sessionExpired]);

  return { data, loading, error, refresh };
}

/**
 * Genera array de fechas
 */
function generateDays(startDate, count) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
