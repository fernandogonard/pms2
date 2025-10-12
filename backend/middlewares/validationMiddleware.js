// middlewares/validationMiddleware.js
// Middleware centralizado de validaciones para el CRM hotelero

const mongoose = require('mongoose');
const { logger } = require('../config/logger');
const { 
  VALID_ROOM_TYPES, 
  VALID_ROOM_STATUS, 
  VALID_RESERVATION_STATUS, 
  VALID_USER_ROLES 
} = require('../constants/businessConstants');

// Validaciones comunes
const commonValidations = {
  // Validar ObjectId de MongoDB
  isValidObjectId: (id) => {
    return mongoose.Types.ObjectId.isValid(id);
  },

  // Validar email
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validar DNI argentino
  isValidDNI: (dni) => {
    const dniRegex = /^\d{7,8}$/;
    return dniRegex.test(dni);
  },

  // Validar teléfono/WhatsApp
  isValidPhone: (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  },

  // Validar fechas
  isValidDate: (date) => {
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  },

  // Validar que checkOut sea posterior a checkIn
  isValidDateRange: (checkIn, checkOut) => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    return checkOutDate > checkInDate;
  },

  // Validar tipos de habitación
  isValidRoomType: (type) => {
    return VALID_ROOM_TYPES.includes(type);
  },

  // Validar estados de habitación
  isValidRoomStatus: (status) => {
    return VALID_ROOM_STATUS.includes(status);
  },

  // Validar estados de reserva
  isValidReservationStatus: (status) => {
    return VALID_RESERVATION_STATUS.includes(status);
  },

  // Validar roles de usuario
  isValidUserRole: (role) => {
    return VALID_USER_ROLES.includes(role);
  }
};

// Middleware de validación para parámetros de ruta
const validateRouteParams = (validations) => {
  return (req, res, next) => {
    const errors = [];

    for (const [param, validation] of Object.entries(validations)) {
      const value = req.params[param];
      
      if (!value) {
        errors.push(`Parámetro '${param}' requerido`);
        continue;
      }

      switch (validation.type) {
        case 'objectId':
          if (!commonValidations.isValidObjectId(value)) {
            errors.push(`Parámetro '${param}' debe ser un ObjectId válido`);
          }
          break;
        case 'string':
          if (typeof value !== 'string' || value.trim().length === 0) {
            errors.push(`Parámetro '${param}' debe ser una cadena no vacía`);
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`Parámetro '${param}' debe ser un número válido`);
          }
          break;
      }
    }

    if (errors.length > 0) {
      logger.warn(`Validación de parámetros fallida: ${errors.join(', ')}`, {
        route: req.path,
        params: req.params
      });
      return res.status(400).json({
        success: false,
        message: 'Parámetros de ruta inválidos',
        errors
      });
    }

    next();
  };
};

// Middleware de validación para body de requests
const validateRequestBody = (schema) => {
  return (req, res, next) => {
    const errors = [];
    const body = req.body;

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      // Verificar campos requeridos
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`Campo '${field}' es requerido`);
        continue;
      }

      // Si el campo no es requerido y está vacío, continuar
      if (!rules.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Validaciones específicas
      for (const rule of rules.validations || []) {
        switch (rule.type) {
          case 'email':
            if (!commonValidations.isValidEmail(value)) {
              errors.push(`Campo '${field}' debe ser un email válido`);
            }
            break;
          case 'dni':
            if (!commonValidations.isValidDNI(value)) {
              errors.push(`Campo '${field}' debe ser un DNI válido (7-8 dígitos)`);
            }
            break;
          case 'phone':
            if (!commonValidations.isValidPhone(value)) {
              errors.push(`Campo '${field}' debe ser un teléfono válido`);
            }
            break;
          case 'date':
            if (!commonValidations.isValidDate(value)) {
              errors.push(`Campo '${field}' debe ser una fecha válida`);
            }
            break;
          case 'roomType':
            if (!commonValidations.isValidRoomType(value)) {
              errors.push(`Campo '${field}' debe ser un tipo de habitación válido (doble, triple, cuádruple)`);
            }
            break;
          case 'roomStatus':
            if (!commonValidations.isValidRoomStatus(value)) {
              errors.push(`Campo '${field}' debe ser un estado válido (disponible, ocupada, limpieza, mantenimiento)`);
            }
            break;
          case 'reservationStatus':
            if (!commonValidations.isValidReservationStatus(value)) {
              errors.push(`Campo '${field}' debe ser un estado válido (reservada, checkin, checkout, cancelada)`);
            }
            break;
          case 'userRole':
            if (!commonValidations.isValidUserRole(value)) {
              errors.push(`Campo '${field}' debe ser un rol válido (admin, recepcionista, cliente)`);
            }
            break;
          case 'objectId':
            if (!commonValidations.isValidObjectId(value)) {
              errors.push(`Campo '${field}' debe ser un ObjectId válido`);
            }
            break;
          case 'minLength':
            if (typeof value === 'string' && value.length < rule.value) {
              errors.push(`Campo '${field}' debe tener al menos ${rule.value} caracteres`);
            }
            break;
          case 'maxLength':
            if (typeof value === 'string' && value.length > rule.value) {
              errors.push(`Campo '${field}' no debe exceder ${rule.value} caracteres`);
            }
            break;
          case 'min':
            if (typeof value === 'number' && value < rule.value) {
              errors.push(`Campo '${field}' debe ser mayor o igual a ${rule.value}`);
            }
            break;
          case 'max':
            if (typeof value === 'number' && value > rule.value) {
              errors.push(`Campo '${field}' debe ser menor o igual a ${rule.value}`);
            }
            break;
        }
      }
    }

    // Validación especial para rangos de fechas
    if (schema.checkIn && schema.checkOut && body.checkIn && body.checkOut) {
      if (!commonValidations.isValidDateRange(body.checkIn, body.checkOut)) {
        errors.push('La fecha de check-out debe ser posterior a la fecha de check-in');
      }
    }

    if (errors.length > 0) {
      logger.warn(`Validación de body fallida: ${errors.join(', ')}`, {
        route: req.path,
        body: { ...body, password: body.password ? '[OCULTO]' : undefined }
      });
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors
      });
    }

    next();
  };
};

// Schemas de validación predefinidos
const validationSchemas = {
  // Schema para crear/actualizar cliente
  client: {
    nombre: {
      required: true,
      validations: [
        { type: 'minLength', value: 2 },
        { type: 'maxLength', value: 50 }
      ]
    },
    apellido: {
      required: true,
      validations: [
        { type: 'minLength', value: 2 },
        { type: 'maxLength', value: 50 }
      ]
    },
    dni: {
      required: true,
      validations: [{ type: 'dni' }]
    },
    email: {
      required: true,
      validations: [{ type: 'email' }]
    },
    whatsapp: {
      required: true,
      validations: [{ type: 'phone' }]
    }
  },

  // Schema para crear/actualizar habitación
  room: {
    number: {
      required: true,
      validations: [
        { type: 'min', value: 1 },
        { type: 'max', value: 9999 }
      ]
    },
    floor: {
      required: true,
      validations: [
        { type: 'min', value: 1 },
        { type: 'max', value: 50 }
      ]
    },
    type: {
      required: true,
      validations: [{ type: 'roomType' }]
    },
    price: {
      required: true,
      validations: [
        { type: 'min', value: 0 }
      ]
    },
    status: {
      required: false,
      validations: [{ type: 'roomStatus' }]
    }
  },

  // Schema para crear reserva
  reservation: {
    tipo: {
      required: true,
      validations: [{ type: 'roomType' }]
    },
    cantidad: {
      required: true,
      validations: [
        { type: 'min', value: 1 },
        { type: 'max', value: 10 }
      ]
    },
    client: {
      required: true,
      validations: [{ type: 'objectId' }]
    },
    checkIn: {
      required: true,
      validations: [{ type: 'date' }]
    },
    checkOut: {
      required: true,
      validations: [{ type: 'date' }]
    },
    status: {
      required: false,
      validations: [{ type: 'reservationStatus' }]
    }
  },

  // Schema para registro/login de usuario
  user: {
    name: {
      required: true,
      validations: [
        { type: 'minLength', value: 2 },
        { type: 'maxLength', value: 100 }
      ]
    },
    email: {
      required: true,
      validations: [{ type: 'email' }]
    },
    password: {
      required: true,
      validations: [
        { type: 'minLength', value: 6 },
        { type: 'maxLength', value: 100 }
      ]
    },
    role: {
      required: false,
      validations: [{ type: 'userRole' }]
    }
  }
};

module.exports = {
  commonValidations,
  validateRouteParams,
  validateRequestBody,
  validationSchemas
};