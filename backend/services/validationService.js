// Validation service - Sistema centralizado de validaciones con Joi
const Joi = require('joi');

// Esquemas de validación reutilizables
const schemas = {
  // Usuario
  user: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required(),
    role: Joi.string().valid('admin', 'recepcionista', 'cliente').default('cliente')
  }),

  // Habitación
  room: Joi.object({
    number: Joi.number().integer().min(1).max(9999).required(),
    type: Joi.string().min(3).max(50).required(),
    price: Joi.number().min(0).required(),
    floor: Joi.number().integer().min(1).max(50).required(),
    status: Joi.string().valid('disponible', 'ocupada', 'limpieza', 'mantenimiento', 'fuera de servicio').default('disponible'),
    capacity: Joi.number().integer().min(1).max(10).default(2),
    amenities: Joi.array().items(Joi.string()).default([]),
    images: Joi.array().items(Joi.string().uri()).default([]),
    description: Joi.string().max(500).allow('').default('')
  }),

  // Reservación
  reservation: Joi.object({
    clientId: Joi.string().required(),
    roomId: Joi.string().required(),
    checkIn: Joi.date().iso().required(),
    checkOut: Joi.date().iso().greater(Joi.ref('checkIn')).required(),
    guests: Joi.number().integer().min(1).max(10).required(),
    totalPrice: Joi.number().min(0).required(),
    status: Joi.string().valid('confirmada', 'checkin', 'checkout', 'checked-in', 'checked-out', 'cancelada').default('confirmada'),
    specialRequests: Joi.string().max(500).allow('').default(''),
    paymentStatus: Joi.string().valid('pendiente', 'parcial', 'completado', 'reembolsado').default('pendiente')
  }),

  // Schema para crear reservas desde el formulario público (auto-crea cliente)
  reservationCreate: Joi.object({
    tipo: Joi.string().valid('doble', 'triple', 'cuadruple').required(),
    cantidad: Joi.number().integer().min(1).default(1),
    checkIn: Joi.date().iso().required(),
    checkOut: Joi.date().iso().greater(Joi.ref('checkIn')).required(),
    nombre: Joi.string().min(2).max(50).required(),
    apellido: Joi.string().min(2).max(50).required(),
    dni: Joi.string().min(5).max(20).required(),
    email: Joi.string().email().required(),
    whatsapp: Joi.string().allow('').optional(),
    notas: Joi.string().max(500).allow('').optional()
  }),

  // Cliente
  client: Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[+]?[\d\s\-()]+$/).min(10).max(20).required(),
    idType: Joi.string().valid('dni', 'pasaporte', 'cedula').required(),
    idNumber: Joi.string().min(5).max(20).required(),
    address: Joi.string().max(200).allow('').default(''),
    city: Joi.string().max(50).allow('').default(''),
    country: Joi.string().max(50).allow('').default(''),
    dateOfBirth: Joi.date().max('now').allow(null),
    preferences: Joi.array().items(Joi.string()).default([])
  }),

  // Login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required()
  }),

  // Cambio de contraseña
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),

  // Habitación — actualización parcial (todos los campos opcionales)
  roomUpdate: Joi.object({
    number: Joi.number().integer().min(1).max(9999).optional(),
    type: Joi.string().min(3).max(50).optional(),
    price: Joi.number().min(0).optional(),
    floor: Joi.number().integer().min(0).max(50).optional(),
    status: Joi.string().valid('disponible', 'ocupada', 'limpieza', 'mantenimiento', 'fuera de servicio').optional(),
    capacity: Joi.number().integer().min(1).max(10).optional(),
    amenities: Joi.array().items(Joi.string()).optional(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    description: Joi.string().max(500).allow('').optional()
  }),

  // MongoDB ObjectId
  mongoId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),

  // Filtros de fecha
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    days: Joi.number().integer().min(1).max(365).optional()
  }),

  // Paginación
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('createdAt')
  }),

  // Analytics
  analyticsQuery: Joi.object({
    range: Joi.string().valid('7d', '30d', '90d').default('7d'),
    metric: Joi.string().valid('occupancy', 'revenue', 'adr', 'revpar').optional()
  })
};

// Función para validar datos
const validate = (schema, data, options = {}) => {
  const defaultOptions = {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true
  };

  const validationOptions = { ...defaultOptions, ...options };
  const { error, value } = schema.validate(data, validationOptions);

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));

    throw new ValidationError('Datos de entrada inválidos', errorDetails);
  }

  return value;
};

// Middleware de validación
const createValidationMiddleware = (schemaName, source = 'body') => {
  return (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        throw new Error(`Esquema de validación '${schemaName}' no encontrado`);
      }

      const dataToValidate = req[source];
      const validatedData = validate(schema, dataToValidate);
      
      // Reemplazar los datos originales con los validados y sanitizados
      req[source] = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: error.details
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno de validación'
      });
    }
  };
};

// Validación de parámetros de URL
const validateParams = (schemaName) => createValidationMiddleware(schemaName, 'params');

// Validación de query parameters
const validateQuery = (schemaName) => createValidationMiddleware(schemaName, 'query');

// Error personalizado de validación
class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

// Validaciones específicas comunes
const commonValidations = {
  // Validar que el usuario tiene permisos
  validateOwnership: (resourceUserId, currentUserId, role) => {
    if (role === 'admin') return true;
    return resourceUserId.toString() === currentUserId.toString();
  },

  // Validar fechas de reserva
  validateReservationDates: (checkIn, checkOut) => {
    const now = new Date();
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkInDate < now) {
      throw new ValidationError('La fecha de check-in no puede ser en el pasado');
    }

    if (checkOutDate <= checkInDate) {
      throw new ValidationError('La fecha de check-out debe ser posterior al check-in');
    }

    const daysDiff = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      throw new ValidationError('La reserva no puede ser por más de 365 días');
    }

    return { checkIn: checkInDate, checkOut: checkOutDate, nights: daysDiff };
  },

  // Validar capacidad de habitación
  validateRoomCapacity: (roomCapacity, guests) => {
    if (guests > roomCapacity) {
      throw new ValidationError(`La habitación solo tiene capacidad para ${roomCapacity} huéspedes`);
    }
    return true;
  },

  // Sanitizar entrada de texto
  sanitizeText: (text) => {
    if (typeof text !== 'string') return text;
    
    return text
      .trim()
      .replace(/<[^>]*>/g, '') // Remover HTML tags
      .replace(/[<>\"'&]/g, '') // Remover caracteres peligrosos
      .substring(0, 1000); // Limitar longitud
  }
};

/**
 * Servicio de compatibilidad con validaciones existentes
 */
class ValidationService {
  /**
   * Valida campos requeridos
   * @param {Object} data - Objeto con datos
   * @param {Array} requiredFields - Array de campos requeridos
   * @returns {Object} { valid, missing } - Estado de validación y campos faltantes
   */
  static validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Valida tipo de habitación
   */
  static validateRoomType(type) {
    const { ROOM_TYPES } = require('../constants/businessConstants');
    return Object.values(ROOM_TYPES).includes(type);
  }

  /**
   * Valida estado de habitación
   */
  static validateRoomStatus(status) {
    const { ROOM_STATUS } = require('../constants/businessConstants');
    return Object.values(ROOM_STATUS).includes(status);
  }

  /**
   * Valida estado de reserva
   */
  static validateReservationStatus(status) {
    const { RESERVATION_STATUS } = require('../constants/businessConstants');
    return Object.values(RESERVATION_STATUS).includes(status);
  }

  /**
   * Valida email
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida DNI argentino
   */
  static validateDNI(dni) {
    // DNI debe tener entre 7 y 8 dígitos
    return /^\d{7,8}$/.test(dni);
  }

  /**
   * Valida número de habitación
   */
  static validateRoomNumber(number) {
    return Number.isInteger(number) && number > 0 && number < 10000;
  }

  /**
   * Valida rango de fechas
   */
  static validateDateRange(checkIn, checkOut) {
    const DateService = require('./dateService');
    if (!checkIn || !checkOut) return false;
    
    const checkInDate = DateService.parseDate(checkIn);
    const checkOutDate = DateService.parseDate(checkOut);
    
    // Verificar fechas válidas
    if (!checkInDate || !checkOutDate) {
      return false;
    }
    
    // Checkout debe ser posterior a checkin
    return checkOutDate > checkInDate;
  }
}

module.exports = {
  schemas,
  validate,
  createValidationMiddleware,
  validateParams,
  validateQuery,
  ValidationError,
  commonValidations,
  ValidationService
};