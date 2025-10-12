// services/stateValidationService.js
// Servicio para validar transiciones de estado de habitaciones y reservas

/**
 * Estados válidos para habitaciones
 */
const ROOM_STATES = {
  DISPONIBLE: 'disponible',
  OCUPADA: 'ocupada', 
  LIMPIEZA: 'limpieza',
  MANTENIMIENTO: 'mantenimiento'
};

/**
 * Estados válidos para reservas
 */
const RESERVATION_STATES = {
  RESERVADA: 'reservada',
  CHECKIN: 'checkin',
  CHECKOUT: 'checkout',
  CANCELADA: 'cancelada'
};

/**
 * Transiciones válidas para habitaciones
 * Formato: estadoActual -> [estadosPermitidos]
 */
const ROOM_TRANSITIONS = {
  [ROOM_STATES.DISPONIBLE]: [
    ROOM_STATES.OCUPADA,      // Check-in
    ROOM_STATES.LIMPIEZA,     // Limpieza manual
    ROOM_STATES.MANTENIMIENTO // Mantenimiento
  ],
  [ROOM_STATES.OCUPADA]: [
    ROOM_STATES.LIMPIEZA,     // Check-out normal
    ROOM_STATES.DISPONIBLE,   // Check-out sin limpieza (excepcional)
    ROOM_STATES.MANTENIMIENTO // Emergencia
  ],
  [ROOM_STATES.LIMPIEZA]: [
    ROOM_STATES.DISPONIBLE,   // Limpieza completada
    ROOM_STATES.MANTENIMIENTO // Problema detectado durante limpieza
  ],
  [ROOM_STATES.MANTENIMIENTO]: [
    ROOM_STATES.DISPONIBLE,   // Mantenimiento completado
    ROOM_STATES.LIMPIEZA      // Requiere limpieza después de mantenimiento
  ]
};

/**
 * Transiciones válidas para reservas
 */
const RESERVATION_TRANSITIONS = {
  [RESERVATION_STATES.RESERVADA]: [
    RESERVATION_STATES.CHECKIN,   // Check-in normal
    RESERVATION_STATES.CANCELADA  // Cancelación antes del check-in
  ],
  [RESERVATION_STATES.CHECKIN]: [
    RESERVATION_STATES.CHECKOUT,  // Check-out normal
    RESERVATION_STATES.CANCELADA  // Cancelación durante la estancia (excepcional)
  ],
  [RESERVATION_STATES.CHECKOUT]: [
    // Estado final - no se puede cambiar
  ],
  [RESERVATION_STATES.CANCELADA]: [
    RESERVATION_STATES.RESERVADA  // Reactivar reserva (excepcional)
  ]
};

/**
 * Valida si una transición de estado de habitación es permitida
 * @param {string} currentState - Estado actual
 * @param {string} newState - Estado nuevo deseado
 * @returns {Object} { valid: boolean, message: string }
 */
function validateRoomStateTransition(currentState, newState) {
  // Verificar estados válidos
  if (!Object.values(ROOM_STATES).includes(currentState)) {
    return {
      valid: false,
      message: `Estado actual inválido: ${currentState}`
    };
  }

  if (!Object.values(ROOM_STATES).includes(newState)) {
    return {
      valid: false,
      message: `Estado nuevo inválido: ${newState}`
    };
  }

  // Si es el mismo estado, permitir (idempotente)
  if (currentState === newState) {
    return {
      valid: true,
      message: `Estado ${newState} confirmado`
    };
  }

  // Verificar transición permitida
  const allowedTransitions = ROOM_TRANSITIONS[currentState] || [];
  if (!allowedTransitions.includes(newState)) {
    return {
      valid: false,
      message: `Transición no permitida: ${currentState} → ${newState}. Estados permitidos: ${allowedTransitions.join(', ')}`
    };
  }

  return {
    valid: true,
    message: `Transición válida: ${currentState} → ${newState}`
  };
}

/**
 * Valida si una transición de estado de reserva es permitida
 * @param {string} currentState - Estado actual
 * @param {string} newState - Estado nuevo deseado
 * @returns {Object} { valid: boolean, message: string }
 */
function validateReservationStateTransition(currentState, newState) {
  // Verificar estados válidos
  if (!Object.values(RESERVATION_STATES).includes(currentState)) {
    return {
      valid: false,
      message: `Estado actual inválido: ${currentState}`
    };
  }

  if (!Object.values(RESERVATION_STATES).includes(newState)) {
    return {
      valid: false,
      message: `Estado nuevo inválido: ${newState}`
    };
  }

  // Si es el mismo estado, permitir (idempotente)
  if (currentState === newState) {
    return {
      valid: true,
      message: `Estado ${newState} confirmado`
    };
  }

  // Verificar transición permitida
  const allowedTransitions = RESERVATION_TRANSITIONS[currentState] || [];
  if (!allowedTransitions.includes(newState)) {
    return {
      valid: false,
      message: `Transición no permitida: ${currentState} → ${newState}. Estados permitidos: ${allowedTransitions.join(', ')}`
    };
  }

  return {
    valid: true,
    message: `Transición válida: ${currentState} → ${newState}`
  };
}

/**
 * Obtiene estados permitidos desde un estado actual
 * @param {string} currentState - Estado actual
 * @param {string} type - 'room' o 'reservation'
 * @returns {Array<string>} - Array de estados permitidos
 */
function getAllowedStates(currentState, type) {
  if (type === 'room') {
    return ROOM_TRANSITIONS[currentState] || [];
  } else if (type === 'reservation') {
    return RESERVATION_TRANSITIONS[currentState] || [];
  }
  return [];
}

/**
 * Valida reglas de negocio específicas para habitaciones
 * @param {Object} room - Habitación
 * @param {string} newState - Estado nuevo deseado
 * @returns {Object} { valid: boolean, message: string }
 */
function validateRoomBusinessRules(room, newState) {
  // Regla: No se puede marcar como ocupada si hay mantenimiento
  if (newState === ROOM_STATES.OCUPADA && room.status === ROOM_STATES.MANTENIMIENTO) {
    return {
      valid: false,
      message: 'No se puede ocupar una habitación en mantenimiento'
    };
  }

  // Regla: No se puede marcar como ocupada si está en limpieza el mismo día
  if (newState === ROOM_STATES.OCUPADA && room.status === ROOM_STATES.LIMPIEZA) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Esta regla se podría afinar con más lógica temporal
    return {
      valid: false,
      message: 'No se puede ocupar una habitación en limpieza hasta que esté disponible'
    };
  }

  return { valid: true, message: 'Reglas de negocio válidas' };
}

/**
 * Valida reglas de negocio específicas para reservas
 * @param {Object} reservation - Reserva
 * @param {string} newState - Estado nuevo deseado
 * @returns {Object} { valid: boolean, message: string }
 */
function validateReservationBusinessRules(reservation, newState) {
  // Regla: No se puede hacer check-in antes de la fecha
  if (newState === RESERVATION_STATES.CHECKIN) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(reservation.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    
    if (today < checkInDate) {
      return {
        valid: false,
        message: `No se puede hacer check-in antes de la fecha programada (${checkInDate.toISOString().split('T')[0]})`
      };
    }
  }

  // Regla: No se puede hacer checkout antes del check-in
  if (newState === RESERVATION_STATES.CHECKOUT && reservation.status !== RESERVATION_STATES.CHECKIN) {
    return {
      valid: false,
      message: 'No se puede hacer check-out sin haber hecho check-in primero'
    };
  }

  return { valid: true, message: 'Reglas de negocio válidas' };
}

module.exports = {
  ROOM_STATES,
  RESERVATION_STATES,
  ROOM_TRANSITIONS,
  RESERVATION_TRANSITIONS,
  validateRoomStateTransition,
  validateReservationStateTransition,
  getAllowedStates,
  validateRoomBusinessRules,
  validateReservationBusinessRules
};