const { logger } = require('./loggerService');

// Prioridad PMS para overlays y estados (ORDEN CRÍTICO - NO CAMBIAR)
// 1. fuera_de_servicio: habitación completamente fuera de operaciones
// 2. mantenimiento: reparación, inspección, etc.
// 3. limpieza: preparar habitación entre huéspedes
// 4. checkout_hoy: checkout pendiente en este día
// 5. checkin_pendiente: check-in esperado hoy pero no confirmado
// 6. ocupada: huésped presente
// 7. disponible: libre para reservar

const STATE_PRIORITY = [
  'fuera_de_servicio',
  'mantenimiento',
  'checkout_hoy',
  'limpieza',
  'checkin_pendiente',
  'ocupada',
  'disponible',
];

// Dado un array de overlays, retorna el estado PMS final
const resolveState = (overlays) => {
  for (const state of STATE_PRIORITY) {
    if (overlays.includes(state)) {
      return state;
    }
  }
  return 'disponible';
};
// AvailabilityService.js
// Servicio para calcular la disponibilidad y estados de habitaciones
// Helper robusto para compatibilidad room: array o string
// IMPORTANTE: Validar null/undefined PRIMERO
const reservationIncludesRoom = (reservationRoom, roomId) => {
  // Si room es null/undefined/array vacío = reserva virtual, no asigna habitación
  if (!reservationRoom) {
    return false;
  }
  
  if (Array.isArray(reservationRoom)) {
    return reservationRoom.some(r => r && r.toString() === roomId.toString());
  }
  
  return reservationRoom.toString() === roomId.toString();
};

const normalizeDate = (value) => {
  if (!value) return null;
  
  let d;
  if (typeof value === 'string') {
    // Parsear string YYYY-MM-DD o ISO string
    const [year, month, day] = value.split('T')[0].split('-').map(Number);
    d = new Date(year, month - 1, day); // Local date, no timezone issues
  } else if (value instanceof Date) {
    d = new Date(value);
  } else {
    return null;
  }
  
  d.setHours(0, 0, 0, 0);
  return d;
};

const dateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// PMS Diva: Prioridad de estados
// 1. fuera_de_servicio
// 2. limpieza
// 3. checkout_hoy
// 4. checkin_pendiente
// 5. ocupada
// 6. disponible
const DEFAULT_CHECKIN_HOUR = 14; // 14:00 si no hay hora
const DEFAULT_CHECKOUT_HOUR = 11; // 11:00 si no hay hora


const calculateRoomStates = (rooms, reservations, startDate, days) => {
  // Validar inputs
  if (!Array.isArray(rooms) || !Array.isArray(reservations) || !startDate || days < 1) {
    return [];
  }

  const start = normalizeDate(startDate);
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }

  return rooms.map(room => {
    const states = {};

    // STEP 1: fuera_de_servicio (override total)
    // Si la habitación está completamente fuera de servicio, retornar inmediatamente
    if (room.status === 'fuera_de_servicio' || room.outOfService) {
      dates.forEach(d => {
        states[dateKey(d)] = 'fuera_de_servicio';
      });
      return { ...room, states };
    }

    // STEP 2: Procesar todas las fechas
    dates.forEach(d => {
      const key = dateKey(d);
      const overlays = [];

      // STEP 2A: Mantenimiento (máxima prioridad después de fuera_de_servicio)
      // Opción 1: maintenanceDates explícitas (si existen)
      if (room.maintenanceDates && Array.isArray(room.maintenanceDates)) {
        if (room.maintenanceDates.includes(key)) {
          overlays.push('mantenimiento');
        }
      }
      // Opción 2: currentMaintenance con startDate/estimatedEndDate
      if (overlays.length === 0 && room.currentMaintenance && room.currentMaintenance.startDate && room.currentMaintenance.estimatedEndDate) {
        const maintStart = normalizeDate(room.currentMaintenance.startDate);
        const maintEnd = normalizeDate(room.currentMaintenance.estimatedEndDate);
        if (maintStart && maintEnd && d >= maintStart && d <= maintEnd) {
          overlays.push('mantenimiento');
        }
      }
      // Opción 3: room.status es mantenimiento pero sin fechas → solo marcar hoy y días pasados
      if (overlays.length === 0 && room.status === 'mantenimiento' && !room.currentMaintenance?.estimatedEndDate) {
        overlays.push('mantenimiento');
      }

      if (overlays.length === 0) {
        // STEP 2B: Procesar reservas
        let hasCheckoutToday = false;
        let hasCheckinToday = false;
        
        for (const res of reservations) {
          // Ignorar reservas canceladas
          if (res.status === 'cancelada') continue;

          // Ignorar reservas que no incluyen esta habitación
          if (!reservationIncludesRoom(res.room, room._id)) continue;

          // Validación: checkIn y checkOut deben ser fechas válidas
          if (!res.checkIn || !res.checkOut) {
            continue; // Saltar reserva inválida (fallback a disponible)
          }

          try {
            const checkIn = normalizeDate(res.checkIn);
            const checkOut = normalizeDate(res.checkOut);

            // Validación: checkOut debe ser > checkIn
            if (checkOut <= checkIn) {
              continue; // Saltar reserva inválida
            }

            const isCheckinDay = dateKey(checkIn) === key;
            const isCheckoutDay = dateKey(checkOut) === key;

            // REGLA PMS: Día de checkOut SIEMPRE es checkout_hoy
            // (nunca ocupada, incluso si hay confirmación)
            if (isCheckoutDay) {
              hasCheckoutToday = true;
              overlays.push('checkout_hoy');
              break; // No procesar más reservas para este día
            }

            // REGLA PMS: Día de checkIn
            if (isCheckinDay) {
              hasCheckinToday = true;
              if (res.checkinConfirmed) {
                // Si está confirmado = ocupada
                overlays.push('ocupada');
              } else {
                // Si no está confirmado = checkin_pendiente
                overlays.push('checkin_pendiente');
              }
              break; // No procesar más reservas para este día
            }

            // REGLA PMS: Días ESTRICTAMENTE ENTRE checkIn y checkOut
            // (excluyendo ambos = ocupada)
            if (d > checkIn && d < checkOut) {
              overlays.push('ocupada');
              break; // No procesar más reservas para este día
            }
          } catch (error) {
            // Si hay error parsing fechas, ignorar reserva
            logger.warn(`[calculateRoomStates] Error validando reserva ${res._id}:`, error);
            continue;
          }
        }
        
        // STEP 2C: Limpieza (manual O automática)
        // Agregar limpieza: manual seteada O auto-limpieza después de checkout
        // (STATE_PRIORITY decidirá cuál gana si hay conflicto con reservas)
        
        // Limpieza manual (explícitamente seteada)
        if (room.cleaningDates && Array.isArray(room.cleaningDates)) {
          if (room.cleaningDates.includes(key)) {
            overlays.push('limpieza');
          }
        }
        
        // AUTO-LIMPIEZA: si hay checkout ayer y no hay checkout/checkin hoy
        if (!hasCheckoutToday && !hasCheckinToday && !overlays.includes('limpieza')) {
          for (const res of reservations) {
            if (res.status === 'cancelada') continue;
            if (!reservationIncludesRoom(res.room, room._id)) continue;
            
            try {
              const checkOut = normalizeDate(res.checkOut);
              if (!checkOut) continue;
              
              // Si el día siguiente al checkout es hoy
              const nextDayAfterCheckout = new Date(checkOut);
              nextDayAfterCheckout.setDate(nextDayAfterCheckout.getDate() + 1);
              if (dateKey(nextDayAfterCheckout) === key) {
                // Verificar si hay OTRA reserva DESPUÉS de hoy
                let hasNextReservation = false;
                for (const r2 of reservations) {
                  if (r2.status === 'cancelada' || r2._id === res._id) continue;
                  if (!reservationIncludesRoom(r2.room, room._id)) continue;
                  const ci2 = normalizeDate(r2.checkIn);
                  // Otra reserva debe comenzar DESPUÉS de hoy (excluyendo hoy mismo, ya procesado en STEP 2B)
                  if (ci2 && dateKey(ci2) !== key && ci2 >= d) {
                    hasNextReservation = true;
                    break;
                  }
                }
                
                if (hasNextReservation) {
                  overlays.push('limpieza');
                  break;
                }
              }
            } catch (error) {
              continue;
            }
          }
        }
      }

      // STEP 3: Resolver estado final basado en prioridad
      states[key] = resolveState(overlays);
    });

    return { ...room, states };
  });
};

module.exports = {
  calculateRoomStates
};