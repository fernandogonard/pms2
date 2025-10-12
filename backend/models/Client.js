// models/Client.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  dni: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  whatsapp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Método para obtener nombre completo
clientSchema.methods.getFullName = function() {
  return `${this.nombre} ${this.apellido}`.trim();
};

// Virtual para nombre completo
clientSchema.virtual('fullName').get(function() {
  return this.getFullName();
});

// Asegurar que los virtuales se incluyan en JSON
clientSchema.set('toJSON', { virtuals: true });
clientSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Client', clientSchema);