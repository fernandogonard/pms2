// routes/authRoutes.js
// Rutas de autenticación mejoradas con validaciones centralizadas

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { loginLimiter, registerLimiter } = require('../config/rateLimiter');

// 🆕 Importar validaciones Joi
const { createValidationMiddleware } = require('../services/validationService');

// 🆕 Registro de usuario con validación Joi
router.post('/register', 
  registerLimiter, 
  createValidationMiddleware('user'), // 🔄 Nueva validación Joi
  authController.register
);

// 🆕 Login de usuario con validación Joi  
router.post('/login', 
  loginLimiter, 
  createValidationMiddleware('login'), // 🔄 Nueva validación Joi
  authController.login
);

// Renovar token
router.post('/refresh-token', authController.refreshToken);

// Obtener usuario actual (requiere autenticación)
router.get('/me', protect, authController.getCurrentUser);

// 🆕 Cambiar contraseña con validación Joi (requiere autenticación)
router.post('/change-password', 
  protect, 
  createValidationMiddleware('changePassword'), // 🔄 Nueva validación Joi
  authController.changePassword
);

// Logout (requiere autenticación)
router.post('/logout', protect, authController.logout);

module.exports = router;
