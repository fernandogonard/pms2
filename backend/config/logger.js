// config/logger.js
// SHIM de compatibilidad — delega al sistema de logging unificado (services/loggerService.js)
// No instanciar un segundo logger Winston; usar una unica instancia en todo el backend.

const { logger, requestLogger } = require('../services/loggerService');

function serializeError(err) {
	if (!err) return {};
	return {
		name: err.name,
		message: err.message,
		code: err.code,
		stack: err.stack
	};
}

// Compatibilidad con llamadas heredadas de server.js y otros módulos.
const logHelpers = {
	system: {
		dbConnected: () => logger.info('MongoDB conectado exitosamente'),
		dbError: (err) => logger.error('Error de conexión MongoDB', { error: serializeError(err) })
	},
	security: {
		rateLimitExceeded: (ip, endpoint) =>
			logger.warn('Rate limit excedido', { ip, endpoint }),
		bruteForce: (ip, attempts) =>
			logger.warn('Posible fuerza bruta detectada', { ip, attempts }),
		maliciousRequest: (ip, path, value) =>
			logger.warn('Request malicioso detectado', { ip, path, value })
	}
};

module.exports = { logger, logHelpers, requestLogger };
