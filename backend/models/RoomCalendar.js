const mongoose = require('mongoose');

const roomCalendarSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['disponible', 'reservada', 'ocupada', 'mantenimiento'],
    required: true
  },
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation'
  }
});

roomCalendarSchema.index({ room: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('RoomCalendar', roomCalendarSchema);