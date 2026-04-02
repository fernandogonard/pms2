// hooks/useCalendarData.js
// Hook para manejar datos del calendario con cache y debounce
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../utils/api';

export const useCalendarData = (startDate, days = 14) => {
  const resolvedStart = startDate || new Date().toISOString().slice(0, 10);
  const [data, setData] = useState([]);
  const [reservationsMap, setReservationsMap] = useState({});
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

      // Traer reservas activas para enriquecer el calendario
      let resMap = {}; // { roomId_date: reservationInfo }
      try {
        const resResp = await apiFetch('/api/reservations', { signal: abortControllerRef.current.signal });
        if (resResp.ok) {
          const reservations = await resResp.json();
          const activeRes = (Array.isArray(reservations) ? reservations : [])
            .filter(r => r.status !== 'cancelada');
          for (const r of activeRes) {
            const roomIds = Array.isArray(r.room) ? r.room : (r.room ? [r.room] : []);
            const ci = new Date(r.checkIn);
            const co = new Date(r.checkOut);
            for (const rid of roomIds) {
              const roomId = typeof rid === 'object' ? (rid._id || rid) : rid;
              for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
                const key = `${roomId}_${d.toISOString().split('T')[0]}`;
                resMap[key] = {
                  guest: r.client ? `${r.client.nombre || ''} ${r.client.apellido || ''}`.trim() : (r.name || ''),
                  email: r.client?.email || r.email || '',
                  dni: r.client?.dni || '',
                  phone: r.client?.whatsapp || r.client?.phone || '',
                  checkIn: r.checkIn?.slice(0, 10),
                  checkOut: r.checkOut?.slice(0, 10),
                  status: r.status,
                  tipo: r.tipo,
                  reservationId: r._id
                };
              }
            }
          }
        }
      } catch { /* silenciar — reservas son enriquecimiento opcional */ }

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
          const roomId = item._id || item.id;
          return {
            roomId,
            roomNumber: item.number,
            roomType: item.type,
            roomStatus: item.status,
            roomPrice: item.price,
            roomFloor: item.floor,
            lastCleaning: item.lastCleaning,
            pendingHousekeeping: item.pendingHousekeeping,
            currentMaintenance: item.currentMaintenance,
            dates: Object.entries(statesObj).map(([date, status]) => {
              let finalStatus = status === 'disponible' ? 'available' : status;
              // Fix: si la room tiene mantenimiento con fin estimado, no marcar días posteriores
              if (finalStatus === 'mantenimiento' && item.currentMaintenance?.estimatedEndDate) {
                const endDate = new Date(item.currentMaintenance.estimatedEndDate).toISOString().split('T')[0];
                if (date > endDate) finalStatus = 'available';
              }
              return {
                date,
                status: finalStatus,
                reservation: resMap[`${roomId}_${date}`] || null
              };
            })
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
