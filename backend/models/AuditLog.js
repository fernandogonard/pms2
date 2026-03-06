// models/AuditLog.js
// Registro inmutable de acciones del sistema (quién hizo qué y cuándo)

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'RESERVA_CREADA', 'RESERVA_EDITADA', 'RESERVA_CANCELADA', 'RESERVA_ELIMINADA',
      'CHECKIN_REALIZADO', 'CHECKOUT_REALIZADO',
      'PAGO_PROCESADO', 'CARGO_AGREGADO',
      'HABITACION_EDITADA', 'HABITACION_ESTADO_CAMBIADO',
      'CLIENTE_CREADO', 'CLIENTE_EDITADO', 'CLIENTE_ELIMINADO',
      'USUARIO_CREADO', 'USUARIO_EDITADO', 'USUARIO_ELIMINADO',
      'LOGIN', 'LOGOUT',
      'PRECIO_ACTUALIZADO',
      'OTRO'
    ]
  },
  entity: { type: String, required: true },     // 'Reservation', 'Room', 'Client', etc.
  entityId: { type: String },                    // ID del objeto afectado
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String, required: true },
  userRole: { type: String, enum: ['admin', 'recepcionista', 'sistema'], default: 'sistema' },
  description: { type: String, required: true }, // Mensaje legible
  details: { type: mongoose.Schema.Types.Mixed }, // Datos extra (before/after, amounts, etc.)
  ip: { type: String },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: false,
  collection: 'audit_logs'
});

// Índices para búsquedas rápidas
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
