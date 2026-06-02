// config/logger.js
// SHIM de compatibilidad — delega al sistema de logging unificado (services/loggerService.js)
// No instanciar un segundo logger Winston; usar una unica instancia en todo el backend.

const { logger, requestLogger } = require('../services/loggerService');
const logHelpers = {};

module.exports = { logger, logHelpers, requestLogger };
