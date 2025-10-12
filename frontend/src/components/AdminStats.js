// components/AdminStats.js
// Estadísticas clave para el dashboard admin
import React, { useEffect, useState } from 'react';

import { apiFetch } from '../utils/api';
const API_ROOMS = '/api/rooms';
const API_RESERVATIONS = '/api/reservations';
const API_STATS = '/api/stats/rooms';

const AdminStats = () => {
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [roomsRes, reservationsRes, statsRes] = await Promise.all([
          apiFetch(API_ROOMS),
          apiFetch(API_RESERVATIONS),
          apiFetch(API_STATS, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          })
        ]);
        const roomsData = await roomsRes.json();
        const reservationsData = await reservationsRes.json();
        const statsData = await statsRes.json();
        
        setRooms(Array.isArray(roomsData) ? roomsData : []);
        setReservations(Array.isArray(reservationsData) ? reservationsData : []);
        setStats(statsData);
      } catch (e) {
        console.error('Error cargando estadísticas:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
    
    // Actualizar cada 30 segundos para mantener datos frescos
    const interval = setInterval(() => {
      load();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Estadísticas
  const today = new Date().toISOString().slice(0, 10);
  
  // Utilizar stats del backend para habitaciones ocupadas/disponibles
  const totalRooms = stats?.stats?.total || rooms.length;
  const occupiedRooms = stats?.stats?.ocupadas || 0;
  
  // Contar reservas de hoy (check-in hoy o reserva activa hoy)
  const todayReservations = reservations.filter(r => {
    if (!r.checkIn || !r.checkOut) return false;
    const checkIn = r.checkIn.slice(0, 10);
    const checkOut = r.checkOut.slice(0, 10);
    return (checkIn <= today && checkOut >= today);
  });
  
  // Identificar reservas activas con check-in
  const activeCheckins = reservations.filter(r => r.status === 'checkin');
  
  // Ingresos estimados: sumar precio por cada reserva activa hoy
  const estimatedIncome = todayReservations.reduce((sum, r) => {
    // Si la reserva tiene pricing.total, usar ese valor
    if (r.pricing && r.pricing.total) {
      return sum + r.pricing.total;
    }
    
    // Si la reserva tiene habitación asignada, usar el precio de esa habitación
    if (Array.isArray(r.room) && r.room.length > 0) {
      let roomPrice = 0;
      r.room.forEach(roomId => {
        const roomObj = rooms.find(room => room._id === roomId);
        if (roomObj) roomPrice += roomObj.price;
      });
      if (roomPrice > 0) return sum + roomPrice;
    } else if (r.room) {
      const roomObj = rooms.find(room => room._id === r.room);
      if (roomObj) return sum + roomObj.price;
    }
    
    // Si no, usar el precio promedio del tipo reservado
    const tipoRooms = rooms.filter(room => room.type === r.tipo);
    const avgPrice = tipoRooms.length > 0 ? tipoRooms.reduce((s, room) => s + room.price, 0) / tipoRooms.length : 0;
    return sum + avgPrice;
  }, 0);

  if (loading) return (
    <div style={{ textAlign: 'center', margin: '24px 0' }}>
      <div style={{ display: 'inline-block', width: 40, height: 40, border: '5px solid #222', borderTop: '5px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`}</style>
      <div style={{ color: '#fff', marginTop: 12 }}>Cargando estadísticas...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
      <div style={{ background: '#0a0a0a', color: '#fff', padding: 24, borderRadius: 8, flex: 1 }}>
        <h3>Ocupación/Stock descontado</h3>
        <p>{occupiedRooms} / {totalRooms} habitaciones ocupadas o reservadas</p>
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#888' }}>
          Check-ins activos: {activeCheckins.length}
        </div>
        {stats && (
          <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#888' }}>
            Disponibles: {stats.stats.disponibles} | Limpieza: {stats.stats.limpieza} | Mantenimiento: {stats.stats.mantenimiento}
          </div>
        )}
      </div>
      <div style={{ background: '#0047AB', color: '#fff', padding: 24, borderRadius: 8, flex: 1 }}>
        <h3>Ingresos estimados hoy</h3>
        <p>${Math.round(estimatedIncome)}</p>
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#ccc' }}>
          Basado en {todayReservations.length} reservas activas
        </div>
      </div>
      <div style={{ background: '#fff', color: '#0a0a0a', padding: 24, borderRadius: 8, flex: 1 }}>
        <h3>Reservas activas hoy</h3>
        <p>{todayReservations.length}</p>
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#555' }}>
          Actualizado: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
