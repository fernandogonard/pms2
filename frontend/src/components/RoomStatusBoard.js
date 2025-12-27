// components/RoomStatusBoard.js
// Estado en tiempo real de habitaciones para el panel recepcionista
import React, { useEffect, useState } from 'react';
import { createWS } from '../utils/wsClient';
import { apiFetch } from '../utils/api';
import redirectorService from '../services/redirectorService';
import useSessionGuard from '../hooks/useSessionGuard';

const API_ROOMS_STATUS = '/api/rooms/status';

const RoomStatusBoard = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { canFetch, sessionExpired, authLoading } = useSessionGuard();

  useEffect(() => {
    if (!canFetch) {
      if (authLoading) {
        setLoading(true);
        setError('');
      } else {
        setLoading(false);
        if (sessionExpired) {
          setError('Tu sesión expiró. Inicia sesión nuevamente para ver el estado de las habitaciones.');
        } else {
          setError('Debes iniciar sesión para ver el estado de las habitaciones.');
        }
        setRooms([]);
      }
      return undefined;
    }

    let didCancel = false;
    let client;

    const fetchAll = async () => {
      try {
        const res = await apiFetch(API_ROOMS_STATUS);
        const data = await res.json();
        if (didCancel) return;
        setRooms(Array.isArray(data) ? data : []);
        setLoading(false);
      } catch (err) {
        if (didCancel) return;
        setError('No se pudieron cargar los datos.');
        setLoading(false);
      }
    };

    const buildWsBase = () => {
      const wsUrl = redirectorService.getWebSocketUrl();
      if (wsUrl) {
        return wsUrl.replace('/ws', '');
      }

      const wsEnv = process.env.REACT_APP_WS_URL && process.env.REACT_APP_WS_URL.trim();
      const apiEnv = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim();
      let base = wsEnv || apiEnv || (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://localhost:5000';
      if (!wsEnv && !apiEnv && typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
        const p = window.location.port;
        if (p === '3000' || p === '3001') {
          const savedPort = localStorage.getItem('backend-port') || '5000';
          base = base.replace(/:30(00|01)$/, `:${savedPort}`);
        }
      }
      if (!/^wss?:\/\//i.test(base)) {
        base = base.replace(/^http/i, 'ws');
      }
      return base;
    };

    const startRealtime = () => {
      const wsBase = `${buildWsBase().replace(/\/$/, '')}/ws`;
      client = createWS(wsBase, {
        onopen: () => !didCancel && setError(''),
        onmessage: (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type && payload.type.startsWith('reservation_')) {
              fetchAll();
            }
          } catch (e) {
            // noop
          }
        },
        onclose: () => !didCancel && setError('Conexión en tiempo real desconectada. Reconectando...'),
        onerror: () => !didCancel && setError('Error en la conexión en tiempo real. Intentando reconectar...')
      });
    };

    setError('');
    setLoading(true);
    fetchAll();
    startRealtime();

    return () => {
      didCancel = true;
      if (client) {
        client.close();
      }
    };
  }, [canFetch, sessionExpired, authLoading]);

  if (loading) return (
    <div style={{ textAlign: 'center', margin: '24px 0' }}>
      <div style={{ display: 'inline-block', width: 40, height: 40, border: '5px solid #222', borderTop: '5px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
      <div style={{ color: '#fff', marginTop: 12 }}>Cargando estado de habitaciones...</div>
    </div>
  );

  const cardStyle = {
    border: '1px solid #333',
    borderRadius: 12,
    padding: 18,
    background: '#1C1C1C',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <h2>Estado en tiempo real de habitaciones</h2>
      {error && <div style={{ color: '#ef4444', marginBottom: 8, fontWeight: 500 }}>{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {rooms.map(room => {
          let color = '#22c55e';
          if (room.status === 'ocupada') color = '#ef4444';
          if (room.status === 'limpieza' || room.status === 'mantenimiento') color = '#2563eb';
          return (
            <div key={room._id} style={cardStyle}>
              <h4 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>HAB {room.number}</h4>
              <p style={{ margin: '8px 0', color: '#bbb' }}>Piso: {room.floor}</p>
              <p style={{ margin: '8px 0', color: '#bbb' }}>Tipo: {room.type}</p>
              <p style={{ margin: '8px 0', color, fontWeight: 500 }}>
                Estado: {room.status}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoomStatusBoard;
