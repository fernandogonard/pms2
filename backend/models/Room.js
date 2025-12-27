// models/Room.js
// Modelo de habitación para el CRM hotelero

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Room', roomSchema);
