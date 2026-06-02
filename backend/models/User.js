// models/User.js
// Modelo de usuario para el CRM hotelero

const mongoose = require('mongoose');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (v) => validator.isEmail(v),
      message: 'Email no tiene un formato válido'
    }
  },
  password: {
    type: String,
    required: true,
    select: false,
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres']
  },
  role: {
    type: String,
    enum: ['admin', 'recepcionista', 'cliente'],
    default: 'cliente'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  }
});

// Excluir password y __v de toda serialización JSON
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

userSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
