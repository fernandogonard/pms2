/**
 * @file errorMiddleware.js
 * @description Middleware avanzado para manejo de errores
 * 
 * Este middleware implementa un manejo global de errores para Express,
 * utilizando el servicio de manejo de errores para categorización y
 * formateo consistente de respuestas de error.
 */

const { logger } = require('../services/loggerService');
const ErrorHandlingService = require('../services/errorHandlingService');

/**
 * Middleware global de manejo de errores
 * Debe ser el último middleware registrado
 */
const globalErrorHandler = (error, req, res, next) => {
  // Si ya se envió una respuesta, delegar al handler por defecto de Express
  if (res.headersSent) {
    return next(error);
  }

  // Categorizar el error
  const errorInfo = ErrorHandlingService.categorizeError(error, `${req.method} ${req.path}`);
  
  // Datos sensibles que deben ser sanitizados
  const sanitizedBody = req.method === 'POST' || req.method === 'PUT' ? 
    { ...req.body, password: req.body?.password ? '[OCULTO]' : undefined } : 
    undefined;

  // Log del error con contexto completo
  logger.error('Error no manejado capturado por middleware global', {
    service: 'crm-hotelero',
    errorType: errorInfo.type,
    statusCode: errorInfo.statusCode,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: sanitizedBody,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString(),
    details: errorInfo.details
  });

  // Enviar respuesta estructurada al cliente
  return res.status(errorInfo.statusCode).json({
    success: false,
    error: {
      type: errorInfo.type,
      message: errorInfo.userMessage,
      code: errorInfo.statusCode
    },
    // Solo incluir detalles en desarrollo
    ...(process.env.NODE_ENV === 'development' && { 
      developerInfo: {
        message: error.message,
        details: errorInfo.details,
        operation: `${req.method} ${req.path}`,
        stack: error.stack?.split('\n').slice(0, 5)
      }
    }),
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware para capturar rutas no encontradas (404)
 */
const notFoundHandler = (req, res) => {
  logger.info('Ruta no encontrada', {
    service: 'crm-hotelero',
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    event: 'ROUTE_NOT_FOUND'
  });
  
  res.status(404).json({
    success: false,
    error: {
      type: ErrorHandlingService.ERROR_TYPES.NOT_FOUND,
      message: 'La ruta solicitada no existe',
      code: 404
    },
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware para capturar errores de JSON malformado
 */
const jsonErrorHandler = (error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    logger.security.anomaly('JSON malformado recibido', {
      service: 'crm-hotelero',
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      error: error.message,
      anomalyType: 'MALFORMED_INPUT',
      severity: 'MEDIUM'
    });
    
    return res.status(400).json({
      success: false,
      error: {
        type: ErrorHandlingService.ERROR_TYPES.BAD_REQUEST,
        message: 'Formato de datos JSON inválido',
        code: 400
      },
      timestamp: new Date().toISOString()
    });
  }
  
  next(error);
};

/**
 * Middleware para timeout de solicitudes
 */
const requestTimeoutHandler = (req, res, next) => {
  const timeout = parseInt(process.env.REQUEST_TIMEOUT) || 30000; // 30 segundos por defecto
  
  req.setTimeout(timeout, () => {
    logger.error('Timeout de solicitud', {
      service: 'crm-hotelero',
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      timeout,
      event: 'REQUEST_TIMEOUT'
    });
    
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: {
          type: ErrorHandlingService.ERROR_TYPES.INTERNAL,
          message: 'La solicitud ha excedido el tiempo máximo permitido',
          code: 408
        },
        timestamp: new Date().toISOString()
      });
    }
  });
  
  next();
};

module.exports = {
  globalErrorHandler,
  notFoundHandler,
  jsonErrorHandler,
  requestTimeoutHandler
};