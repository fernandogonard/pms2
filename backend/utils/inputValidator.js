// utils/inputValidator.js
// Validador avanzado de inputs con protección enterprise

const validator = require('validator');
const xss = require('xss');

class InputValidator {
  constructor() {
    this.xssOptions = {
      whiteList: {}, // No permitir ningún tag HTML
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style']
    };
  }

  // Validación de email con verificación de dominio
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email requerido' };
    }

    const cleanEmail = email.toLowerCase().trim();

    if (!validator.isEmail(cleanEmail)) {
      return { valid: false, error: 'Formato de email inválido' };
    }

    // Lista negra de dominios temporales
    const blockedDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
      'mailinator.com', 'throwaway.email', 'temp-mail.org'
    ];

    const domain = cleanEmail.split('@')[1];
    if (blockedDomains.includes(domain)) {
      return { valid: false, error: 'Dominio de email no permitido' };
    }

    return { valid: true, value: cleanEmail };
  }

  // Validación de contraseña con complejidad
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Contraseña requerida' };
    }

    const minLength = 8;
    const maxLength = 128;

    if (password.length < minLength) {
      return { valid: false, error: `Contraseña debe tener al menos ${minLength} caracteres` };
    }

    if (password.length > maxLength) {
      return { valid: false, error: `Contraseña no debe exceder ${maxLength} caracteres` };
    }

    // Verificar complejidad
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const complexityCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

    if (complexityCount < 3) {
      return { 
        valid: false, 
        error: 'Contraseña debe contener al menos 3 de: minúsculas, mayúsculas, números, símbolos' 
      };
    }

    // Verificar patrones comunes débiles
    const weakPatterns = [
      /123456/, /password/i, /qwerty/i, /admin/i, /letmein/i,
      /welcome/i, /monkey/i, /dragon/i, /master/i, /login/i
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(password)) {
        return { valid: false, error: 'Contraseña contiene patrones comunes débiles' };
      }
    }

    return { valid: true, value: password };
  }

  // Validación de nombre con caracteres especiales
  validateName(name, fieldName = 'nombre') {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: `${fieldName} requerido` };
    }

    const cleanName = xss(name.trim(), this.xssOptions);

    if (cleanName.length < 2) {
      return { valid: false, error: `${fieldName} debe tener al menos 2 caracteres` };
    }

    if (cleanName.length > 50) {
      return { valid: false, error: `${fieldName} no debe exceder 50 caracteres` };
    }

    // Permitir solo letras, espacios, acentos y guiones
    const namePattern = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+$/;
    if (!namePattern.test(cleanName)) {
      return { valid: false, error: `${fieldName} contiene caracteres inválidos` };
    }

    return { valid: true, value: cleanName };
  }

  // Validación de DNI argentino mejorada
  validateDNI(dni) {
    if (!dni || typeof dni !== 'string') {
      return { valid: false, error: 'DNI requerido' };
    }

    const cleanDNI = dni.replace(/\D/g, '');

    if (cleanDNI.length < 7 || cleanDNI.length > 8) {
      return { valid: false, error: 'DNI debe tener entre 7 y 8 dígitos' };
    }

    // Verificar que no sea un patrón inválido
    const invalidPatterns = [
      /^0+$/, /^1+$/, /^2+$/, /^3+$/, /^4+$/, /^5+$/,
      /^6+$/, /^7+$/, /^8+$/, /^9+$/, /^12345678?$/
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(cleanDNI)) {
        return { valid: false, error: 'DNI contiene un patrón inválido' };
      }
    }

    return { valid: true, value: cleanDNI };
  }

  // Validación de teléfono internacional
  validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, error: 'Teléfono requerido' };
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    if (!validator.isMobilePhone(cleanPhone, 'any', { strictMode: false })) {
      return { valid: false, error: 'Formato de teléfono inválido' };
    }

    return { valid: true, value: cleanPhone };
  }

  // Validación de números de habitación
  validateRoomNumber(number) {
    if (number === undefined || number === null) {
      return { valid: false, error: 'Número de habitación requerido' };
    }

    const numValue = parseInt(number);

    if (isNaN(numValue) || numValue < 1 || numValue > 9999) {
      return { valid: false, error: 'Número de habitación debe estar entre 1 y 9999' };
    }

    return { valid: true, value: numValue };
  }

  // Validación de fechas con rangos lógicos
  validateDate(date, fieldName = 'fecha') {
    if (!date) {
      return { valid: false, error: `${fieldName} requerida` };
    }

    const dateObj = new Date(date);

    if (isNaN(dateObj.getTime())) {
      return { valid: false, error: `${fieldName} tiene formato inválido` };
    }

    const now = new Date();
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(now.getFullYear() + 2);

    if (dateObj < now.setHours(0, 0, 0, 0)) {
      return { valid: false, error: `${fieldName} no puede ser en el pasado` };
    }

    if (dateObj > maxFutureDate) {
      return { valid: false, error: `${fieldName} no puede ser más de 2 años en el futuro` };
    }

    return { valid: true, value: dateObj };
  }

  // Validación de rango de fechas
  validateDateRange(checkIn, checkOut) {
    const checkInValidation = this.validateDate(checkIn, 'Check-in');
    if (!checkInValidation.valid) return checkInValidation;

    const checkOutValidation = this.validateDate(checkOut, 'Check-out');
    if (!checkOutValidation.valid) return checkOutValidation;

    const checkInDate = checkInValidation.value;
    const checkOutDate = checkOutValidation.value;

    if (checkOutDate <= checkInDate) {
      return { valid: false, error: 'Check-out debe ser posterior al check-in' };
    }

    const diffTime = checkOutDate - checkInDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays > 365) {
      return { valid: false, error: 'La estadía no puede exceder 365 días' };
    }

    return { 
      valid: true, 
      value: { checkIn: checkInDate, checkOut: checkOutDate, days: diffDays } 
    };
  }

  // Validación de entrada general con XSS
  validateGeneralInput(input, maxLength = 255) {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Campo requerido' };
    }

    const cleanInput = xss(input.trim(), this.xssOptions);

    if (cleanInput.length > maxLength) {
      return { valid: false, error: `Campo no debe exceder ${maxLength} caracteres` };
    }

    return { valid: true, value: cleanInput };
  }
}

module.exports = new InputValidator();