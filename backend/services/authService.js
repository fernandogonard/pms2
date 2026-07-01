// services/authService.js
// Servicio de autenticación centralizado para el CRM hotelero

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');
const { logger } = require('../config/logger');

class AuthService {
  constructor() {
    // Caché en memoria para usuarios (TTL de 5 minutos)
    this.userCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos

    // Token blacklist en memoria como cache rápido + MongoDB como persistencia
    this._tokenBlacklistCache = new Set();

    // Limpiar tokens expirados del cache cada 30 minutos
    this._blacklistCleanupInterval = setInterval(() => {
      this._cleanExpiredTokensFromCache();
    }, 30 * 60 * 1000);
  }

  /**
   * Limpia tokens expirados de la blacklist en memoria.
   */
  _cleanExpiredTokensFromCache() {
    const now = Math.floor(Date.now() / 1000);
    for (const token of this._tokenBlacklistCache) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp && decoded.exp < now) {
          this._tokenBlacklistCache.delete(token);
        }
      } catch {
        this._tokenBlacklistCache.delete(token);
      }
    }
  }

  /**
   * Añade un token a la blacklist (MongoDB + cache en memoria).
   * @param {string} token - JWT a invalidar
   */
  async blacklistToken(token) {
    try {
      const decoded = jwt.decode(token);
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      await BlacklistedToken.create({ token, expiresAt }).catch(() => {});
      this._tokenBlacklistCache.add(token);
    } catch {
      this._tokenBlacklistCache.add(token);
    }
  }

  /**
   * Verifica si un token está en la blacklist.
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async isTokenBlacklisted(token) {
    if (this._tokenBlacklistCache.has(token)) return true;
    try {
      const found = await BlacklistedToken.exists({ token });
      if (found) this._tokenBlacklistCache.add(token);
      return !!found;
    } catch {
      return false;
    }
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
      logger.debug(`[AuthService] Cache hit para usuario ${userId}`);
      return cached.user;
    }
    
    logger.debug(`[AuthService] Cache miss para usuario ${userId}, consultando DB`);
    const user = await User.findById(userId).lean(); // password ya excluido por select: false
    
    if (user) {
      this.userCache.set(userKey, {
        user,
        timestamp: Date.now()
      });
    }
    
    return user;
  }
  
  // Generar token JWT (access token — solo userId y role, sin PII)
  generateToken(user) {
    const payload = {
      userId: user._id,
      role: user.role
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });
  }

  // Generar refresh token (secret separado para aislamiento)
  generateRefreshToken(user) {
    const payload = {
      userId: user._id,
      type: 'refresh',
      tokenVersion: Number(user.tokenVersion || 0)
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '7d'
    });
  }

  // Verificar access token
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      return null;
    }
  }

  // Verificar refresh token (usa secret separado)
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      logger.warn('Refresh token verification failed', { error: error.message });
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
  // NOTA: isAdmin=true solo debe pasarse desde endpoints protegidos por authorize('admin')
  async register(userData, { isAdmin = false } = {}) {
    try {
      const { name, email, password } = userData;

      // Forzar rol 'cliente' en registro público. Solo admins pueden asignar otros roles.
      const role = isAdmin && userData.role ? userData.role : 'cliente';

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
  async refreshToken(refreshTokenValue) {
    try {
      const decoded = this.verifyRefreshToken(refreshTokenValue);
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

      const currentVersion = Number(user.tokenVersion || 0);
      if (decoded.tokenVersion !== currentVersion) {
        return {
          success: false,
          message: 'Sesión invalidada'
        };
      }

      // Incrementar tokenVersion y guardar
      user.tokenVersion = currentVersion + 1;
      await user.save();
      this.clearUserCache(user._id);

      // Generar nuevo access token con tokenVersion actualizado
      const newAccessToken = this.generateAccessToken(user._id, user.tokenVersion);

      logger.info('Token renovado exitosamente', {
        userId: user._id,
        newTokenVersion: user.tokenVersion
      });

      return {
        success: true,
        accessToken: newAccessToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
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
      
      logger.debug(`[AuthService] getCurrentUser tomó ${queryTime}ms`);
      
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
      await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
      
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

  // Logout — invalida el token añadiéndolo a la blacklist y revoca refresh tokens previos
  async logout(token) {
    try {
      if (token) {
        await this.blacklistToken(token);
      }
      const decoded = this.verifyToken(token);
      if (decoded) {
        await User.findByIdAndUpdate(decoded.userId, { $inc: { tokenVersion: 1 } });
        this.clearUserCache(decoded.userId);
        logger.info('Logout exitoso', { userId: decoded.userId });
      }

      return {
        success: true,
        message: 'Logout exitoso'
      };
    } catch (error) {
      // Token puede ser inválido pero igual lo blacklisteamos
      return {
        success: true,
        message: 'Logout exitoso'
      };
    }
  }
}

module.exports = new AuthService();