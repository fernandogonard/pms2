// constants/businessConstants.js
// Constantes de negocio centralizadas para evitar inconsistencias

// Tipos de habitación disponibles
const ROOM_TYPES = {
  DOBLE: 'doble',
  TRIPLE: 'triple', 
  CUADRUPLE: 'cuadruple',
  SUITE: 'suite'
};

// Array de tipos válidos para validaciones
const VALID_ROOM_TYPES = Object.values(ROOM_TYPES);

// Estados de habitación
const ROOM_STATUS = {
  DISPONIBLE: 'disponible',
  OCUPADA: 'ocupada', 
  LIMPIEZA: 'limpieza',
  MANTENIMIENTO: 'mantenimiento',
  FUERA_DE_SERVICIO: 'fuera de servicio'
};

// Array de estados válidos para validaciones
const VALID_ROOM_STATUS = Object.values(ROOM_STATUS);

// Estados de reserva
const RESERVATION_STATUS = {
  RESERVADA: 'reservada',
  CHECKIN: 'checkin',
  CHECKOUT: 'checkout',
  CANCELADA: 'cancelada'
};

// Array de estados válidos para validaciones
const VALID_RESERVATION_STATUS = Object.values(RESERVATION_STATUS);

// Roles de usuario
const USER_ROLES = {
  ADMIN: 'admin',
  RECEPCIONISTA: 'recepcionista',
  CLIENTE: 'cliente'
};

// Array de roles válidos para validaciones
const VALID_USER_ROLES = Object.values(USER_ROLES);

// Configuraciones de negocio
const BUSINESS_CONFIG = {
  MAX_NIGHTS_PER_RESERVATION: 365,
  MAX_ROOMS_PER_RESERVATION: 10,
  MIN_ROOM_NUMBER: 1,
  MAX_ROOM_NUMBER: 9999,
  MAX_FLOOR_NUMBER: 50,
  DNI_MIN_LENGTH: 7,
  DNI_MAX_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 100,
  
  // ─── HORARIOS Y TIEMPOS ────────────────────────────────────────────────
  CHECKOUT_TIME: '10:00',       // Hora de checkout (10 AM)
  CHECKOUT_ALERT_TIME: '07:00', // Mostrar alerta desde las 7 AM
  
  // Tiempos de limpieza en minutos
  CLEANING_TIMES: {
    repaso: 20,                 // Repaso rápido
    limpieza_profunda: 25,      // Cada 3 noches (cambio sábanas incluido)
    limpieza_checkout: 40       // Post-checkout completa
  }
};

// Monedas soportadas
const CURRENCIES = {
  ARS: 'ARS',
  USD: 'USD',
  EUR: 'EUR'
};

const VALID_CURRENCIES = Object.values(CURRENCIES);

// ─── CONFIGURACIÓN DE VISUALIZACIÓN DE LIMPIEZA ────────────────────────────────
const HOUSEKEEPING_CONFIG = {
  repaso: {
    label: '🧹 Repaso rápido',
    color: '#60a5fa',           // Azul claro
    bgColor: 'rgba(96,165,250,0.15)',
    borderColor: '#60a5fa60',
    duration: 20,
    description: 'Cambio de sábanas y limpieza diaria'
  },
  limpieza_profunda: {
    label: '🧼 Limpieza profunda',
    color: '#a78bfa',           // Púrpura
    bgColor: 'rgba(167,139,250,0.15)',
    borderColor: '#a78bfa60',
    duration: 25,
    description: 'Limpieza completa cada 3 noches'
  },
  limpieza_checkout: {
    label: '🏃 Checkout limpieza',
    color: '#f97316',           // Naranja
    bgColor: 'rgba(249,115,22,0.15)',
    borderColor: '#f9731660',
    duration: 40,
    description: 'Limpieza completa post-checkout'
  }
};

module.exports = {
  // Tipos y estados
  ROOM_TYPES,
  VALID_ROOM_TYPES,
  ROOM_STATUS,
  VALID_ROOM_STATUS,
  RESERVATION_STATUS,
  VALID_RESERVATION_STATUS,
  USER_ROLES,
  VALID_USER_ROLES,
  CURRENCIES,
  VALID_CURRENCIES,
  
  // Configuraciones
  BUSINESS_CONFIG,
  HOUSEKEEPING_CONFIG
};