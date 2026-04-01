// models/Room.js
// Modelo de habitación para el CRM hotelero

const mongoose = require('mongoose');
const { VALID_ROOM_TYPES, VALID_ROOM_STATUS } = require('../constants/businessConstants');

const roomSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: [true, 'El número de habitación es requerido'],
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: [true, 'El tipo de habitación es requerido'],
    enum: VALID_ROOM_TYPES
  },
  floor: {
    type: Number,
    default: 1,
    min: 0
  },
  status: {
    type: String,
    enum: VALID_ROOM_STATUS,
    default: 'disponible'
  },
  active: {
    type: Boolean,
    default: true
  },
  outOfService: {
    type: Boolean,
    default: false
  },
  maintenanceDates: [{
    type: String  // formato YYYY-MM-DD
  }],
  cleaningDates: [{
    type: String  // formato YYYY-MM-DD
  }]
}, {
  timestamps: true
});

// Índices para concurrencia y performance
roomSchema.index({ type: 1, status: 1 });
roomSchema.index({ status: 1 });

module.exports = mongoose.model('Room', roomSchema);
