// src/constants/businessConstants.js
// Constantes de negocio compartidas con el backend

export const HOUSEKEEPING_CONFIG = {
  repaso: {
    label: '🧹 Repaso rápido',
    color: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.15)',
    borderColor: '#60a5fa60',
    duration: 20,
    description: 'Cambio de sábanas y limpieza diaria'
  },
  limpieza_profunda: {
    label: '🧼 Limpieza profunda',
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.15)',
    borderColor: '#a78bfa60',
    duration: 25,
    description: 'Limpieza completa cada 3 noches'
  },
  limpieza_checkout: {
    label: '🏃 Checkout limpieza',
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.15)',
    borderColor: '#f9731660',
    duration: 40,
    description: 'Limpieza completa post-checkout'
  }
};

export const CLEANING_TIMES = {
  repaso: 20,
  limpieza_profunda: 25,
  limpieza_checkout: 40
};

export const BUSINESS_CONFIG = {
  CHECKOUT_TIME: '10:00',
  CHECKOUT_ALERT_TIME: '07:00'
};

export const ROOM_STATUS = {
  DISPONIBLE: 'disponible',
  OCUPADA: 'ocupada',
  LIMPIEZA: 'limpieza',
  MANTENIMIENTO: 'mantenimiento'
};

export const HOUSEKEEPING_STATUS = {
  NO_ASIGNADA: 'no_asignada',
  ASIGNADA: 'asignada',
  EN_PROGRESO: 'en_progreso',
  COMPLETADA: 'completada',
  CANCELADA: 'cancelada'
};
