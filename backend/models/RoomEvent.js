const mongoose = require('mongoose');
const { EVENT_TYPE_LIST } = require('./eventTypes');

const roomEventSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    default: null,
    index: true
  },
  type: {
    type: String,
    enum: EVENT_TYPE_LIST,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  collection: 'room_events',
  timestamps: true
});

roomEventSchema.index({ roomId: 1, timestamp: 1 });
roomEventSchema.index({ timestamp: 1 });
roomEventSchema.index({ roomId: 1, type: 1, timestamp: 1 });

module.exports = mongoose.model('RoomEvent', roomEventSchema);