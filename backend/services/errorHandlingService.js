/**
 * @file errorHandlingService.js
 * @description Servicio centralizado para manejo de errores (versión mejorada)
 * 
 * Este servicio implementa un sistema profesional de manejo y categorización
 * de errores para toda la aplicación, siguiendo patrones de sistemas maduros de PMS.
 * 
 * Características:
 * - Categorización automática de errores
 * - Manejo consistente de respuestas HTTP
 * - Integración con el sistema de logging
 * - Tracking de errores operacionales vs programación
 * - Errores amigables para usuario final vs detallados para desarrollo
 */

const { logger } = require('../services/loggerService');
const mongoose = require('mongoose');

// Tipos de error en la aplicación
const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE: 'DUPLICATE_ENTRY',
  DATABASE: 'DATABASE_ERROR',
  EXTERNAL_API: 'EXTERNAL_API_ERROR',
  BUSINESS_RULE: 'BUSINESS_RULE_VIOLATION',
  RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST'
};

class ErrorHandlingService {
  
  /**
   * Maneja errores de controlador de forma consistente
   * @param {Error} error - El error capturado
   * @param {Object} res - Objeto response de Express
   * @param {string} operation - Nombre de la operación que falló
   * @param {Object} context - Contexto adicional para debugging
   */
  static handleControllerError(error, res, operation, context = {}) {
    // Determinar tipo de error y respuesta apropiada
    const errorResponse = this.categorizeError(error, operation);
    
    // Log del error con contexto mejorado
    logger.error(`Error en ${operation}`, {
      service: 'crm-hotelero',
      errorType: errorResponse.type,
      errorCode: errorResponse.statusCode,
      message: error.message,
      stack: error.stack,
      operation,
      context,
      details: errorResponse.details,
      timestamp: new Date().toISOString()
    });

    // Estructurar respuesta de error según estándar
    return res.status(errorResponse.statusCode).json({
      success: false,
      error: {
        type: errorResponse.type,
        message: errorResponse.userMessage,
        code: errorResponse.statusCode
      },
      // Solo incluir detalles técnicos en desarrollo
      ...(process.env.NODE_ENV === 'development' && { 
        developerInfo: {
          message: errorResponse.message,
          operation,
          details: errorResponse.details,
          stack: error.stack?.split('\n').slice(0, 5) 
        }
      }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Categoriza errores para responses consistentes
   * @param {Error} error - El error a categorizar
   * @param {string} operation - Operación que falló
   * @returns {Object} - Objeto con tipo de error, código HTTP y mensajes
   */
  static categorizeError(error, operation) {
    let errorType = ERROR_TYPES.INTERNAL;
    let statusCode = 500;
    let userMessage = 'Ha ocurrido un error en el servidor';
    let details = {};
    
    // Errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      errorType = ERROR_TYPES.VALIDATION;
      statusCode = 400;
      userMessage = 'Datos de entrada inválidos';
      details = Object.values(error.errors).map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      }));
      return {
        type: errorType,
        statusCode,
        message: 'Datos de entrada inválidos: ' + Object.values(error.errors).map(e => e.message).join(', '),
        userMessage,
        details,
        operation
      };
    }

    // Errores de duplicado (unique constraint)
    if (error.code === 11000 || error.code === 11001) {
      errorType = ERROR_TYPES.DUPLICATE;
      statusCode = 409;
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'campo';
      userMessage = `Ya existe un registro con ese ${field}`;
      details = { field, value: error.keyValue?.[field] };
      return {
        type: errorType,
        statusCode,
        message: userMessage,
        userMessage,
        details,
        operation
      };
    }

    // Errores de casting (ObjectId inválido)
    if (error.name === 'CastError') {
      errorType = ERROR_TYPES.BAD_REQUEST;
      statusCode = 400;
      userMessage = 'ID o formato de datos inválido';
      details = {
        field: error.path,
        value: error.value
      };
      return {
        type: errorType,
        statusCode,
        message: 'ID inválido proporcionado',
        userMessage,
        details,
        operation
      };
    }

    // Errores de JWT
    if (error.name === 'JsonWebTokenError') {
      errorType = ERROR_TYPES.AUTHENTICATION;
      statusCode = 401;
      userMessage = 'Sesión inválida';
      return {
        type: errorType,
        statusCode,
        message: 'Token de autenticación inválido',
        userMessage,
        operation
      };
    }

    if (error.name === 'TokenExpiredError') {
      errorType = ERROR_TYPES.AUTHENTICATION;
      statusCode = 401;
      userMessage = 'Su sesión ha expirado';
      return {
        type: errorType,
        statusCode,
        message: 'Token de autenticación expirado',
        userMessage,
        operation
      };
    }

    // Errores de conexión de base de datos
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      errorType = ERROR_TYPES.DATABASE;
      statusCode = 503;
      userMessage = 'Servicio temporalmente no disponible. Intente nuevamente más tarde.';
      return {
        type: errorType,
        statusCode,
        message: 'Base de datos no disponible',
        userMessage,
        operation,
        details: { name: error.name }
      };
    }

    // Errores personalizados de negocio
    if (error.isBusinessError || error.errorType) {
      errorType = error.errorType || ERROR_TYPES.BUSINESS_RULE;
      statusCode = error.statusCode || 400;
      userMessage = error.userMessage || error.message;
      details = error.details || error.context || {};
      return {
        type: errorType,
        statusCode,
        message: error.message,
        userMessage,
        details,
        operation
      };
    }

    // Error genérico
    return {
      type: errorType,
      statusCode: 500,
      message: error.message || 'Error interno del servidor',
      userMessage: 'Ha ocurrido un error en el servidor',
      operation
    };
  }

  /**
   * Crea un error personalizado con tipo definido
   * @param {string} message - Mensaje técnico del error
   * @param {string} errorType - Tipo de error (de ERROR_TYPES)
   * @param {string} userMessage - Mensaje para usuario final
   * @param {Object} details - Detalles adicionales del error
   * @returns {Error} - Error personalizado
   */
  static createError(message, errorType, userMessage, details = {}) {
    const error = new Error(message);
    error.isBusinessError = true;
    error.errorType = errorType;
    error.statusCode = this.getStatusCodeForErrorType(errorType);
    error.userMessage = userMessage || this.getUserMessageForErrorType(errorType);
    error.details = details;
    return error;
  }

  /**
   * Obtiene código HTTP basado en tipo de error
   * @param {string} errorType - Tipo de error
   * @returns {number} - Código de estado HTTP
   */
  static getStatusCodeForErrorType(errorType) {
    const statusCodes = {
      [ERROR_TYPES.VALIDATION]: 400,
      [ERROR_TYPES.AUTHENTICATION]: 401,
      [ERROR_TYPES.AUTHORIZATION]: 403,
      [ERROR_TYPES.NOT_FOUND]: 404,
      [ERROR_TYPES.DUPLICATE]: 409,
      [ERROR_TYPES.RATE_LIMIT]: 429,
      [ERROR_TYPES.DATABASE]: 500,
      [ERROR_TYPES.EXTERNAL_API]: 502,
      [ERROR_TYPES.INTERNAL]: 500,
      [ERROR_TYPES.BAD_REQUEST]: 400,
      [ERROR_TYPES.BUSINESS_RULE]: 422
    };
    
    return statusCodes[errorType] || 500;
  }

  /**
   * Obtiene mensaje para usuario según tipo de error
   * @param {string} errorType - Tipo de error
   * @returns {string} - Mensaje amigable para usuario
   */
  static getUserMessageForErrorType(errorType) {
    const messages = {
      [ERROR_TYPES.VALIDATION]: 'La información ingresada no es válida',
      [ERROR_TYPES.AUTHENTICATION]: 'Es necesario iniciar sesión',
      [ERROR_TYPES.AUTHORIZATION]: 'No tiene permiso para realizar esta acción',
      [ERROR_TYPES.NOT_FOUND]: 'El recurso solicitado no existe',
      [ERROR_TYPES.DUPLICATE]: 'El recurso ya existe en el sistema',
      [ERROR_TYPES.RATE_LIMIT]: 'Ha excedido el límite de solicitudes',
      [ERROR_TYPES.DATABASE]: 'Error en la base de datos',
      [ERROR_TYPES.EXTERNAL_API]: 'Error en servicio externo',
      [ERROR_TYPES.INTERNAL]: 'Error interno del servidor',
      [ERROR_TYPES.BAD_REQUEST]: 'Solicitud incorrecta',
      [ERROR_TYPES.BUSINESS_RULE]: 'La operación viola reglas del negocio'
    };
    
    return messages[errorType] || 'Ha ocurrido un error';
  }
  
  /**
   * Crea un error de negocio personalizado (método legacy)
   * @param {string} message - Mensaje del error
   * @param {number} statusCode - Código de estado HTTP
   * @param {Object} context - Contexto adicional
   * @returns {Error} - Error personalizado
   */
  static createBusinessError(message, statusCode = 400, context = {}) {
    const error = new Error(message);
    error.isBusinessError = true;
    error.statusCode = statusCode;
    error.context = context;
    error.userMessage = message; // Para retrocompatibilidad
    return error;
  }

  /**
   * Wrapper para funciones async que maneja errores automáticamente
   * @param {Function} controllerFunction - Función del controlador
   * @returns {Function} - Función wrapper con manejo de errores
   */
  static asyncWrapper(controllerFunction) {
    return async (req, res, next) => {
      try {
        await controllerFunction(req, res, next);
      } catch (error) {
        this.handleControllerError(error, res, controllerFunction.name || 'unknown', {
          method: req.method,
          url: req.originalUrl,
          userId: req.user?.id,
          ip: req.ip
        });
      }
    };
  }

  /**
   * Valida campos requeridos y lanza error si faltan
   * @param {Object} data - Datos a validar
   * @param {Array} requiredFields - Campos requeridos
   * @param {string} operation - Operación actual
   */
  static validateRequiredFields(data, requiredFields, operation) {
    const missingFields = requiredFields.filter(field => 
      data[field] === undefined || 
      data[field] === null || 
      data[field] === ''
    );

    if (missingFields.length > 0) {
      throw this.createBusinessError(
        `Campos requeridos faltantes: ${missingFields.join(', ')}`,
        400,
        { operation, missingFields }
      );
    }
  }

  /**
   * Maneja errores de base de datos específicamente
   * @param {Error} error - Error de base de datos
   * @param {string} operation - Operación que falló
   */
  static handleDatabaseError(error, operation) {
    logger.error(`Error de base de datos en ${operation}`, {
      service: 'crm-hotelero',
      error: error.message,
      stack: error.stack,
      operation,
      type: ERROR_TYPES.DATABASE
    });

    if (error.name === 'MongoNetworkError') {
      throw this.createError(
        'Base de datos no disponible', 
        ERROR_TYPES.DATABASE, 
        'Servicio temporalmente no disponible. Intente más tarde.',
        { errorName: error.name, operation }
      );
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'campo';
      throw this.createError(
        `Duplicado: ${field}`, 
        ERROR_TYPES.DUPLICATE, 
        `Ya existe un registro con ese ${field}`,
        { field, value: error.keyValue?.[field] }
      );
    }

    throw this.createError(
      'Error en operación de base de datos', 
      ERROR_TYPES.DATABASE, 
      'Error en la base de datos',
      { operation, errorCode: error.code }
    );
  }
  
  // Errores de negocio específicos
  
  /**
   * Crea un error de recurso no encontrado
   * @param {string} resource - Tipo de recurso (Usuario, Habitación, etc.)
   * @param {string} id - ID del recurso buscado
   * @returns {Error} - Error personalizado
   */
  static createNotFoundError(resource, id) {
    return this.createError(
      `${resource} con ID ${id} no encontrado`, 
      ERROR_TYPES.NOT_FOUND,
      `El ${resource.toLowerCase()} solicitado no existe`,
      { resource, id }
    );
  }

  /**
   * Crea un error de autorización/permisos
   * @param {string} message - Mensaje del error
   * @returns {Error} - Error personalizado
   */
  static createAuthError(message) {
    return this.createError(
      message || 'No autorizado', 
      ERROR_TYPES.AUTHORIZATION,
      'No tiene permisos para realizar esta acción'
    );
  }

  /**
   * Crea un error por violación de regla de negocio
   * @param {string} rule - Nombre de la regla violada
   * @param {string} message - Mensaje para el usuario
   * @param {Object} details - Detalles adicionales
   * @returns {Error} - Error personalizado
   */
  static createBusinessRuleError(rule, message, details) {
    return this.createError(
      `Regla de negocio violada: ${rule}`, 
      ERROR_TYPES.BUSINESS_RULE,
      message,
      { rule, ...details }
    );
  }
}

// Para mantener compatibilidad con código existente
Object.assign(ErrorHandlingService, { ERROR_TYPES });

// Exportar la clase
module.exports = ErrorHandlingService;