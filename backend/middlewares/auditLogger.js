// middlewares/auditLogger.js
// Middleware para registrar auditorías de acciones críticas

const { logger } = require('../config/logger');

const auditLogger = (req, res, next) => {
  const { method, originalUrl, body, user } = req;

  // Registrar solo acciones críticas
  const criticalActions = ['POST', 'PUT', 'DELETE'];
  if (criticalActions.includes(method)) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      user: user ? user.username : 'anónimo',
      action: method,
      endpoint: originalUrl,
      data: body,
    };

    logger.info(`[AUDIT] ${JSON.stringify(logEntry)}`);
  }

  next();
};

module.exports = { auditLogger };