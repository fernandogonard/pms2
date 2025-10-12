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
  }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
