// models/Reservation.js
// Modelo de reserva para el CRM hotelero

const mongoose = require('mongoose');
const { VALID_ROOM_TYPES, VALID_RESERVATION_STATUS } = require('../constants/businessConstants');

const reservationSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: VALID_ROOM_TYPES,
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1
  },
  // Ahora soportamos asignación múltiple: array de ObjectId de Room
  room: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true  // Ahora siempre requerido
  },
  // ❌ Eliminados: name, email (ahora se obtienen de Client)
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: VALID_RESERVATION_STATUS,
    default: 'reservada'
  },
  // 🆕 CAMPOS DE FACTURACIÓN
  pricing: {
    pricePerNight: {
      type: Number,
      required: true,
      min: 0
    },
    totalNights: {
      type: Number,
      required: true,
      min: 1
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxes: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'ARS',
      enum: ['ARS', 'USD', 'EUR']
    }
  },
  payment: {
    status: {
      type: String,
      enum: ['pendiente', 'parcial', 'pagado', 'reembolsado'],
      default: 'pendiente'
    },
    method: {
      type: String,
      enum: ['efectivo', 'tarjeta', 'transferencia', 'cheque'],
      default: 'efectivo'
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentDate: Date,
    transactionId: String,
    notes: String
  },
  invoice: {
    number: {
      type: String,
      unique: true,
      sparse: true  // Solo único si no es null
    },
    issueDate: Date,
    dueDate: Date,
    isPaid: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual para obtener información del cliente de forma consistente
reservationSchema.virtual('clientInfo', {
  ref: 'Client',
  localField: 'client',
  foreignField: '_id',
  justOne: true
});

// Método para obtener nombre completo del cliente
reservationSchema.methods.getClientFullName = function() {
  if (this.client && typeof this.client === 'object') {
    return `${this.client.nombre} ${this.client.apellido}`.trim();
  }
  return 'Cliente no disponible';
};

// Método para obtener email del cliente
reservationSchema.methods.getClientEmail = function() {
  if (this.client && typeof this.client === 'object') {
    return this.client.email;
  }
  return null;
};

// 🆕 MÉTODOS DE FACTURACIÓN
// Calcular noches entre fechas
reservationSchema.methods.calculateNights = function() {
  const diffTime = Math.abs(this.checkOut - this.checkIn);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
};

// Calcular precios automáticamente
reservationSchema.methods.calculatePricing = async function(roomTypeModel) {
  const nights = this.calculateNights();
  const pricePerNight = await roomTypeModel.getPriceByType(this.tipo);
  
  const subtotal = pricePerNight * nights * this.cantidad;
  const taxes = subtotal * 0.21; // IVA 21%
  const total = subtotal + taxes;
  
  this.pricing = {
    pricePerNight,
    totalNights: nights,
    subtotal,
    taxes,
    total,
    currency: 'ARS'
  };
  
  return this.pricing;
};

// Generar número de factura único
reservationSchema.methods.generateInvoiceNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `INV-${year}${month}${day}-${random}`;
};

// Procesar pago
reservationSchema.methods.processPayment = function(amount, method, transactionId = null) {
  this.payment.amountPaid += amount;
  this.payment.method = method;
  this.payment.paymentDate = new Date();
  this.payment.transactionId = transactionId;
  
  // Actualizar estado de pago
  if (this.payment.amountPaid >= this.pricing.total) {
    this.payment.status = 'pagado';
    this.invoice.isPaid = true;
  } else if (this.payment.amountPaid > 0) {
    this.payment.status = 'parcial';
  }
  
  return this.payment;
};

// Asegurar que los virtuales se incluyan en JSON
reservationSchema.set('toJSON', { virtuals: true });
reservationSchema.set('toObject', { virtuals: true });

// ─── Índices para queries frecuentes ───────────────────────────────────────────
reservationSchema.index({ status: 1 });                         // filtrar por estado
reservationSchema.index({ checkIn: 1, checkOut: 1 });           // rango de fechas
reservationSchema.index({ status: 1, checkIn: 1, checkOut: 1 });// query principal de ocupación
reservationSchema.index({ client: 1 });                         // reservas de un cliente
reservationSchema.index({ room: 1 });                           // habitaciones de una reserva
reservationSchema.index({ 'payment.status': 1 });               // facturas pendientes

module.exports = mongoose.model('Reservation', reservationSchema);
