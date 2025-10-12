// models/RoomType.js
// Modelo para tipos de habitación con precios

const mongoose = require('mongoose');
const { VALID_ROOM_TYPES, VALID_CURRENCIES } = require('../constants/businessConstants');

const roomTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del tipo de habitación es requerido'],
    unique: true,
    enum: VALID_ROOM_TYPES
  },
  basePrice: {
    type: Number,
    required: [true, 'El precio base es requerido'],
    min: [0, 'El precio debe ser mayor a 0']
  },
  currency: {
    type: String,
    default: 'ARS',
    enum: VALID_CURRENCIES
  },
  capacity: {
    type: Number,
    required: [true, 'La capacidad es requerida'],
    min: 1
  },
  description: {
    type: String,
    default: ''
  },
  amenities: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para formato de precio
roomTypeSchema.virtual('formattedPrice').get(function() {
  const symbols = { ARS: '$', USD: 'U$S', EUR: '€' };
  return `${symbols[this.currency] || '$'} ${this.basePrice.toLocaleString()}`;
});

// Método estático para obtener precio por tipo
roomTypeSchema.statics.getPriceByType = async function(typeName) {
  const roomType = await this.findOne({ name: typeName, isActive: true });
  return roomType ? roomType.basePrice : 0;
};

module.exports = mongoose.model('RoomType', roomTypeSchema);