// models/Room.js
// Modelo de habitación para el CRM hotelero

const mongoose = require('mongoose');
const { VALID_ROOM_TYPES, VALID_ROOM_STATUS } = require('../constants/businessConstants');

// Esquema para el historial de mantenimiento
const maintenanceHistorySchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  estimatedEndDate: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['normal', 'high', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['en_proceso', 'completado', 'cancelado'],
    default: 'en_proceso'
  },
  notes: {
    type: String
  },
  requestedBy: {
    type: String
  },
  completedBy: {
    type: String
  }
}, { timestamps: true });

// Esquema para mantenimiento actual
const currentMaintenanceSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  estimatedEndDate: {
    type: Date,
    required: true
  },
  priority: {
    type: String,
    enum: ['normal', 'high', 'urgent'],
    default: 'normal'
  },
  requestedBy: {
    type: String
  }
});

const roomSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    unique: true
  },
  floor: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: VALID_ROOM_TYPES,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: VALID_ROOM_STATUS,
    default: 'disponible'
  },
  // Campos para mantenimiento
  maintenanceHistory: [maintenanceHistorySchema],
  currentMaintenance: currentMaintenanceSchema,
  lastCleaning: {
    type: Date
  },
  notes: {
    type: String
  },
  // Tarea de housekeeping pendiente
  // null = sin tarea | 'repaso' = repaso diario | 'limpieza_profunda' = limpieza cada 3 noches | 'limpieza_checkout' = post-checkout
  pendingHousekeeping: {
    type: String,
    enum: [null, 'repaso', 'limpieza_profunda', 'limpieza_checkout'],
    default: null
  },
  pendingHousekeepingAt: {
    type: Date,
    default: null
  },

  // ─── DATOS DE CHECKOUT PRÓXIMO ─────────────────────────────────────────────
  checkoutToday: {
    type: Boolean,
    default: false,
    index: true
  },
  checkoutInfo: {
    reservationId: mongoose.Schema.Types.ObjectId,
    guestName: String,
    checkoutTime: Date,        // Hora exacta del checkout (10:00 AM del día)
    checkoutDate: String,      // YYYY-MM-DD
    nightsStayed: Number,
    totalAmount: Number,
    amountPaid: Number,
    isPaid: Boolean,
    daysOverdue: Number        // Si ya pasó la hora
  },

  // ─── ASIGNACIÓN DE LIMPIEZA ─────────────────────────────────────────────
  housekeepingAssignment: {
    assignedTo: String,        // Nombre de limpiador o ID
    assignedAt: Date,
    estimatedDurationMinutes: {
      type: Number,
      default: null             // 20 para repaso, 40 para checkout
    },
    startTime: Date,
    endTime: Date,
    status: {
      type: String,
      enum: ['no_asignada', 'asignada', 'en_progreso', 'completada', 'cancelada'],
      default: 'no_asignada'
    },
    notes: String
  }
}, { timestamps: true });

// ─── Índices para queries frecuentes ───────────────────────────────────────────
roomSchema.index({ status: 1 });                  // filtrar por estado
roomSchema.index({ type: 1 });                    // filtrar por tipo
roomSchema.index({ status: 1, type: 1 });         // filtrar por estado + tipo

module.exports = mongoose.model('Room', roomSchema);
