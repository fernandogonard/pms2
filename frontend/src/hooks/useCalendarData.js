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

      // Normalizar: Railway devuelve {rooms:[{..., calendar:{date:status}}], dateRange, assignments, summary}
      // /calendar-status devuelve [{roomId, roomNumber, roomType, dates:[{date, status, reservation}]}]
      let items = result;
      let assignmentsMap = {};
      if (!Array.isArray(result) && result && Array.isArray(result.rooms)) {
        items = result.rooms;
        // Guardar assignments para enriquecer datos de reservas
        if (result.assignments) assignmentsMap = result.assignments;
      }
      const normalized = Array.isArray(items) ? items.map(item => {
        // Formato calendar-status: ya tiene roomId + dates array
        if (item.roomId && Array.isArray(item.dates)) return item;

        // Formato Railway /status: {_id, number, type, calendar:{date:status}}
        // o formato alterno:       {_id, number, type, states:{date:status}}
        const statesObj = item.calendar || item.states;
        if ((item._id || item.id) && statesObj && typeof statesObj === 'object') {
          return {
            roomId: item._id || item.id,
            roomNumber: item.number,
            roomType: item.type,
            roomStatus: item.status,
            lastCleaning: item.lastCleaning,
            pendingHousekeeping: item.pendingHousekeeping,
            dates: Object.entries(statesObj).map(([date, status]) => ({
              date,
              status: status === 'disponible' ? 'available' : status,
              reservation: null
            }))
          };
        }
        // Fallback seguro
        return {
          roomId: item._id || item.id || item.roomId || 'unknown',
          roomNumber: item.number || item.roomNumber || '?',
          roomType: item.type || item.roomType || 'unknown',
          roomStatus: item.status,
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
