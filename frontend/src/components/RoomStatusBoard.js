// components/RoomStatusBoard.js
// Estado en tiempo real de habitaciones para el panel recepcionista
import React, { useEffect, useState } from 'react';
import { createWS } from '../utils/wsClient';


const API_ROOMS_STATUS = '/api/rooms/status';

const RoomStatusBoard = () => {

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  useEffect(() => {
    const fetchAll = async () => {
      try {
        const { apiFetch } = await import('../utils/api');
        const res = await apiFetch(API_ROOMS_STATUS);
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : []);
        setLoading(false);
      } catch (err) {
        setError('No se pudieron cargar los datos.');
        setLoading(false);
      }
    };
    fetchAll();
    // WebSocket para refresco en tiempo real (con reconexión)
    setError('');
  // Importar el servicio de redirección de puertos
  const redirectorService = require('../services/redirectorService');
  
  const buildWsBase = () => {
    // Intentar usar el puerto descubierto por el redirectorService
    const wsUrl = redirectorService.getWebSocketUrl();
    if (wsUrl) {
      return wsUrl.replace('/ws', '');
    }
    
    // Fallback al método anterior
    const wsEnv = process.env.REACT_APP_WS_URL && process.env.REACT_APP_WS_URL.trim();
    const apiEnv = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim();
    let base = wsEnv || apiEnv || (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://localhost:5002';
    if (!wsEnv && !apiEnv && typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
      const p = window.location.port;
      if (p === '3000' || p === '3001') {
        // Obtener el puerto guardado del localStorage o usar el puerto por defecto
        const savedPort = localStorage.getItem('backend-port') || '5002';
        base = base.replace(/:30(00|01)$/, `:${savedPort}`);
      }
    }
    if (!/^wss?:\/\//i.test(base)) {
      base = base.replace(/^http/i, 'ws');
    }
    return base;
  };
  const client = createWS(`${buildWsBase().replace(/\/$/, '')}/ws`, {
      onopen: () => setError(''),
      onmessage: (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type && data.type.startsWith('reservation_')) {
            fetchAll();
          }
        } catch (e) {
          // ignore
        }
      },
      onclose: () => setError('Conexión en tiempo real desconectada. Reconectando...'),
      onerror: () => setError('Error en la conexión en tiempo real. Intentando reconectar...')
    });
    return () => client.close();
  }, []);

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
