// controllers/authController.js
// Controlador de autenticación mejorado con validaciones centralizadas

const authService = require('../services/authService');
const { validateRequestBody, validationSchemas } = require('../middlewares/validationMiddleware');
const { logger } = require('../services/loggerService');
const auditService = require('../services/auditService');
const { setRefreshTokenCookie, clearRefreshTokenCookie } = require('../utils/cookieHelper');

// Registro de usuario
exports.register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // Refresh token va en httpOnly cookie, NO en el body
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token
    });

  } catch (error) {
    logger.error('Error en el controlador de registro', error, { 
      email: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Login de usuario
exports.login = async (req, res) => {
  try {
    const { email } = req.body;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    // Log del intento de login
    logger.security.loginAttempt(email, false, ip, userAgent);

    const result = await authService.login(req.body);
    
    if (!result.success) {
      // Log del fallo de login
      logger.security.loginFailure(email, result.message, ip, userAgent);
      return res.status(401).json({
        success: false,
        message: result.message
      });
    }

    // Log del login exitoso
    logger.security.loginSuccess(result.user.id, email, ip, userAgent);

    // Registrar en auditoría
    auditService.log({
      action: 'LOGIN',
      entity: 'User',
      entityId: result.user.id,
      userEmail: email,
      userRole: result.user.role || 'sistema',
      description: `Login exitoso de ${email}`,
      ip
    });

    // Refresh token va en httpOnly cookie
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token
    });

  } catch (error) {
    logger.error('Error en el controlador de login', error, { 
      email: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Renovar token
exports.refreshToken = async (req, res) => {
  try {
    // Leer refresh token desde httpOnly cookie (prioridad) o body (retrocompatibilidad)
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }

    const result = await authService.refreshToken(refreshToken);
    
    if (!result.success) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: result.message
      });
    }

    // Setear nuevo refresh token en cookie
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      success: true,
      token: result.token,
      user: result.user
    });

  } catch (error) {
    logger.error('Error renovando token', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener usuario actual
exports.getCurrentUser = async (req, res) => {
  try {
    const result = await authService.getCurrentUser(req.user.userId);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      user: result.user
    });

  } catch (error) {
    logger.error('Error obteniendo usuario actual', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Cambiar contraseña
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva contraseña son requeridas'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 8 caracteres'
      });
    }

    const result = await authService.changePassword(req.user.userId, currentPassword, newPassword);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    logger.error('Error cambiando contraseña', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    await authService.logout(token);
    
    // Limpiar cookie del refresh token
    clearRefreshTokenCookie(res);

    res.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    logger.error('Error en logout', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Middleware de validación para rutas específicas
exports.validateRegister = validateRequestBody(validationSchemas.user);
exports.validateLogin = validateRequestBody({
  email: {
    required: true,
    validations: [{ type: 'email' }]
  },
  password: {
    required: true,
    validations: [{ type: 'minLength', value: 6 }]
  }
});

// ─── Recuperación de contraseña ───────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Genera un token de reset y envía email con el link.
 * Responde siempre 200 para no revelar si el email existe.
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email es requerido' });
    }

    const crypto = require('crypto');
    const User = require('../models/User');
    const emailService = require('../services/emailService');

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Respuesta siempre 200 — no revelar si el email existe (prevenir user enumeration)
    if (!user) {
      return res.json({ success: true, message: 'Si el email existe, recibirás un enlace de recuperación.' });
    }

    // Generar token aleatorio (32 bytes hex)
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Guardar hash del token (no el token plano) en la BD
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    await emailService.sendPasswordReset({ email: user.email, resetToken, resetUrl });

    logger.info('Token de reset enviado', { email: user.email, ip: req.ip });
    auditService.log({
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user._id,
      userEmail: user.email,
      userRole: user.role,
      description: 'Solicitud de reseteo de contraseña',
      metadata: { ip: req.ip }
    });

    res.json({ success: true, message: 'Si el email existe, recibirás un enlace de recuperación.' });

  } catch (error) {
    logger.error('Error en forgotPassword', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * POST /api/auth/reset-password/:token
 * Valida el token y actualiza la contraseña.
 * Body: { password }
 */
exports.resetPassword = async (req, res) => {
  try {
    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');
    const User = require('../models/User');

    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Hashear el token recibido para comparar con el guardado
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token inválido o expirado' });
    }

    // Actualizar contraseña
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.info('Contraseña reseteada exitosamente', { userId: user._id, ip: req.ip });
    auditService.log({
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'User',
      entityId: user._id,
      userEmail: user.email,
      userRole: user.role,
      description: 'Contraseña reseteada por token',
      metadata: { ip: req.ip }
    });

    res.json({ success: true, message: 'Contraseña actualizada correctamente. Ya podés iniciar sesión.' });

  } catch (error) {
    logger.error('Error en resetPassword', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};
