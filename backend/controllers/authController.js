// controllers/authController.js
// Controlador de autenticación mejorado con validaciones centralizadas

const authService = require('../services/authService');
const { validateRequestBody, validationSchemas } = require('../middlewares/validationMiddleware');
// 🆕 Usar nuevo sistema de logging Winston (eliminado el anterior)
const { logger } = require('../services/loggerService');
const auditService = require('../services/auditService');

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

    res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
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

    res.json({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
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
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }

    const result = await authService.refreshToken(refreshToken);
    
    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      token: result.token,
      refreshToken: result.refreshToken,
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

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
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
