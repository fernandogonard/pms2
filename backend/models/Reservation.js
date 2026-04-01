// models/Reservation.js
// Modelo de reserva para el CRM hotelero

const mongoose = require('mongoose');
const { VALID_ROOM_TYPES, VALID_RESERVATION_STATUS, VALID_CURRENCIES } = require('../constants/businessConstants');

// Sub-schema: Pricing (calculado al crear)
const pricingSchema = new mongoose.Schema({
  pricePerNight: { type: Number, default: 0 },
  totalNights:   { type: Number, default: 0 },
  subtotal:      { type: Number, default: 0 },
  taxes:         { type: Number, default: 0 },
  total:         { type: Number, default: 0 },
  currency:      { type: String, enum: VALID_CURRENCIES, default: 'ARS' },
  roomType: {
    name:        { type: String },
    capacity:    { type: Number },
    description: { type: String }
  }
}, { _id: false });

// Sub-schema: Payment
const paymentSchema = new mongoose.Schema({
  status:        { type: String, enum: ['pendiente', 'parcial', 'pagado', 'reembolsado'], default: 'pendiente' },
  method:        { type: String, default: 'efectivo' },
  amountPaid:    { type: Number, default: 0 },
  paymentDate:   { type: Date },
  transactionId: { type: String },
  notes:         { type: String }
}, { _id: false });

// Sub-schema: Invoice
const invoiceSchema = new mongoose.Schema({
  number:    { type: String },
  issueDate: { type: Date },
  dueDate:   { type: Date },
  isPaid:    { type: Boolean, default: false }
}, { _id: false });

const reservationSchema = new mongoose.Schema({
  // --- Tipo y cantidad (reserva virtual o real) ---
  tipo:     { type: String, enum: VALID_ROOM_TYPES, required: true },
  cantidad: { type: Number, default: 1, min: 1 },

  // --- Habitaciones asignadas (array — puede estar vacío para reservas virtuales) ---
  room: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],

  // --- Relaciones ---
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },

  // --- Datos legacy de contacto (compatibilidad con reservas antiguas) ---
  name:  { type: String },
  email: { type: String },

  // --- Fechas ---
  checkIn:  { type: Date, required: true },
  checkOut: { type: Date, required: true },

  // --- Estado ---
  status: { type: String, enum: VALID_RESERVATION_STATUS, default: 'reservada' },

  // --- Facturación ---
  pricing: { type: pricingSchema, default: () => ({}) },
  payment: { type: paymentSchema, default: () => ({}) },
  invoice: { type: invoiceSchema, default: () => ({}) },

  // --- Auditoría ---
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// --- Validación: checkOut > checkIn ---
reservationSchema.pre('validate', function (next) {
  if (this.checkIn && this.checkOut && this.checkOut <= this.checkIn) {
    return next(new Error('La fecha de check-out debe ser posterior al check-in'));
  }
  next();
});

// --- Índices ---
reservationSchema.index({ tipo: 1, checkIn: 1, checkOut: 1 });
reservationSchema.index({ room: 1, checkIn: 1, checkOut: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ client: 1 });

// Asegurar que los virtuales se incluyan en JSON
reservationSchema.set('toJSON', { virtuals: true });
reservationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Reservation', reservationSchema);
