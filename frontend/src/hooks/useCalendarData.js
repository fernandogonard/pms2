// hooks/useCalendarData.js
// Hook para manejar datos del calendario con cache y debounce
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../utils/api';

export const useCalendarData = (startDate, days = 14) => {
  const resolvedStart = startDate || new Date().toISOString().slice(0, 10);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      // Intentar endpoint primario, fallback al anterior si falla
      let response = await apiFetch(
        `/api/rooms/calendar-status?start=${resolvedStart}&days=${days}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        // Fallback: endpoint autenticado (compatible con deploys anteriores)
        response = await apiFetch(
          `/api/rooms/status?start=${resolvedStart}&days=${days}`,
          { signal: abortControllerRef.current.signal }
        );
      }

      if (!response.ok) throw new Error('Failed to fetch room status');
      const result = await response.json();

      // Normalizar formato: /status devuelve {rooms:[...], reservations, users}
      // mientras que /calendar-status devuelve [{roomId, roomNumber, roomType, dates:[]}]
      let items = result;
      if (!Array.isArray(result) && result && Array.isArray(result.rooms)) {
        items = result.rooms;
      }
      const normalized = Array.isArray(items) ? items.map(item => {
        // Formato calendar-status: ya tiene roomId + dates array
        if (item.roomId && Array.isArray(item.dates)) return item;
        // Formato /status (getRoomsAvailability): {_id, number, type, states:{date:status}}
        if ((item._id || item.id) && item.states && typeof item.states === 'object') {
          return {
            roomId: item._id || item.id,
            roomNumber: item.number,
            roomType: item.type,
            dates: Object.entries(item.states).map(([date, status]) => ({
              date,
              status: status === 'disponible' ? 'available' : status,
              reservation: null
            }))
          };
        }
        // Fallback seguro: garantizar dates como array vacío
        return {
          roomId: item._id || item.id || item.roomId || 'unknown',
          roomNumber: item.number || item.roomNumber || '?',
          roomType: item.type || item.roomType || 'unknown',
          dates: []
        };
      }) : [];

      setData(normalized);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [resolvedStart, days]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchData, 1000);
  }, [fetchData]);

  useEffect(() => {
    debouncedFetch();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [debouncedFetch]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};
