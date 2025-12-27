const mongoose = require('mongoose');

const lockSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  owner: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Lock', lockSchema);
