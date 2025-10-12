// services/authService.js
// Servicio de autenticación centralizado para el CRM hotelero

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { logger } = require('../config/logger');

class AuthService {
  constructor() {
    // Caché en memoria para usuarios (TTL de 5 minutos)
    this.userCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }
  
  // Limpiar caché de usuario
  clearUserCache(userId) {
    this.userCache.delete(userId.toString());
  }
  
  // Obtener usuario desde caché o base de datos
  async getCachedUser(userId) {
    const userKey = userId.toString();
    const cached = this.userCache.get(userKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log(`⚡ [AuthService] Cache hit para usuario ${userId}`);
      return cached.user;
    }
    
    console.log(`🔍 [AuthService] Cache miss para usuario ${userId}, consultando DB`);
    const user = await User.findById(userId).lean(); // .lean() para mejor rendimiento
    
    if (user) {
      this.userCache.set(userKey, {
        user,
        timestamp: Date.now()
      });
    }
    
    return user;
  }
  
  // Generar token JWT
  generateToken(user) {
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });
  }

  // Generar refresh token (válido por más tiempo)
  generateRefreshToken(user) {
    const payload = {
      userId: user._id,
      type: 'refresh'
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
  }

  // Verificar token JWT
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      return null;
    }
  }

  // Hash de contraseña
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verificar contraseña
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Registrar nuevo usuario
  async register(userData) {
    try {
      const { name, email, password, role = 'cliente' } = userData;

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return {
          success: false,
          message: 'El email ya está registrado'
        };
      }

      // Hash de la contraseña
      const hashedPassword = await this.hashPassword(password);

      // Crear usuario
      const user = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role
      });

      await user.save();

      // Generar tokens
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      logger.info('Usuario registrado exitosamente', {
        userId: user._id,
        email: user.email,
        role: user.role
      });

      return {
        success: true,
        message: 'Usuario registrado exitosamente',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        },
        token,
        refreshToken
      };

    } catch (error) {
      logger.error('Error durante el registro', { error: error.message });
      return {
        success: false,
        message: 'Error interno del servidor'
      };
    }
  }

  // Login de usuario
  async login(credentials) {
    try {
      const { email, password } = credentials;

      // Buscar usuario por email
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        logger.warn('Intento de login con email inexistente', { email });
        return {
          success: false,
          message: 'Credenciales inválidas'
        };
      }

      // Verificar contraseña
      const isValidPassword = await this.verifyPassword(password, user.password);
      if (!isValidPassword) {
        logger.warn('Intento de login con contraseña incorrecta', { 
          userId: user._id,
          email: user.email 
        });
        return {
          success: false,
          message: 'Credenciales inválidas'
        };
      }

      // Generar tokens
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      logger.info('Login exitoso', {
        userId: user._id,
        email: user.email,
        role: user.role
      });

      return {
        success: true,
        message: 'Login exitoso',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        },
        token,
        refreshToken
      };

    } catch (error) {
      logger.error('Error durante el login', { error: error.message });
      return {
        success: false,
        message: 'Error interno del servidor'
      };
    }
  }

  // Renovar token usando refresh token
  async refreshToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);
      if (!decoded || decoded.type !== 'refresh') {
        return {
          success: false,
          message: 'Refresh token inválido'
        };
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado'
        };
      }

      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        success: true,
        token: newToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      };

    } catch (error) {
      logger.error('Error renovando token', { error: error.message });
      return {
        success: false,
        message: 'Error interno del servidor'
      };
    }
  }

  // Obtener información del usuario actual (optimizado con caché)
  async getCurrentUser(userId) {
    try {
      const startTime = Date.now();
      const user = await this.getCachedUser(userId);
      const queryTime = Date.now() - startTime;
      
      console.log(`⏱️ [AuthService] getCurrentUser tomó ${queryTime}ms`);
      
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado'
        };
      }

      return {
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      };

    } catch (error) {
      logger.error('Error obteniendo usuario actual', { error: error.message });
      return {
        success: false,
        message: 'Error interno del servidor'
      };
    }
  }

  // Cambiar contraseña
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado'
        };
      }

      // Verificar contraseña actual
      const isValidPassword = await this.verifyPassword(currentPassword, user.password);
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Contraseña actual incorrecta'
        };
      }

      // Hash de la nueva contraseña
      const hashedNewPassword = await this.hashPassword(newPassword);
      
      // Actualizar contraseña
      user.password = hashedNewPassword;
      await user.save();
      
      // Limpiar caché del usuario después de cambio
      this.clearUserCache(userId);

      logger.info('Contraseña cambiada exitosamente', { userId });

      return {
        success: true,
        message: 'Contraseña cambiada exitosamente'
      };

    } catch (error) {
      logger.error('Error cambiando contraseña', { error: error.message });
      return {
        success: false,
        message: 'Error interno del servidor'
      };
    }
  }

  // Logout (invalidar token - en una implementación real usaríamos una blacklist)
  async logout(token) {
    try {
      const decoded = this.verifyToken(token);
      if (decoded) {
        logger.info('Logout exitoso', { userId: decoded.userId });
      }

      return {
        success: true,
        message: 'Logout exitoso'
      };
    } catch (error) {
      return {
        success: true,
        message: 'Logout exitoso'
      };
    }
  }
}

module.exports = new AuthService();