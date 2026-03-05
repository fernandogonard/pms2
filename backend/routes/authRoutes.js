// routes/authRoutes.js
// Rutas de autenticación mejoradas con validaciones centralizadas

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { loginLimiter, registerLimiter } = require('../config/rateLimiter');

// 🆕 Importar validaciones Joi
const { createValidationMiddleware } = require('../services/validationService');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: 'Juan Pérez' }
 *               email: { type: string, format: email, example: 'juan@hotel.com' }
 *               password: { type: string, example: 'miPassword123' }
 *               role: { type: string, enum: [admin, recepcionista, cliente], default: cliente }
 *     responses:
 *       201: { description: Usuario creado exitosamente }
 *       400: { description: Datos inválidos o email ya registrado }
 *       429: { description: Límite de registros alcanzado }
 */
router.post('/register', 
  registerLimiter, 
  createValidationMiddleware('user'),
  authController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso — retorna JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401: { description: Credenciales inválidas }
 *       429: { description: Límite de intentos alcanzado }
 */
router.post('/login', 
  loginLimiter, 
  createValidationMiddleware('login'),
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
