// services/monitoringService.js
// Servicio de monitoreo centralizado — compatible con Sentry o standalone
//
// Activación por ENV:
//   SENTRY_DSN=https://...@sentry.io/...  → activa Sentry (requiere npm install @sentry/node)
//   Sin SENTRY_DSN → fallback a Winston logger (ya existente)
//
// Todas las funciones son no-op seguras si el monitoreo no está configurado.

const { logger } = require('./loggerService');

let sentryAvailable = false;
let Sentry = null;

/**
 * Inicializa el monitoreo. Llamar UNA vez al arrancar el servidor.
 */
function init(app) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('[Monitoring] SENTRY_DSN no configurada — usando solo Winston logger');
    return;
  }

  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version || '1.0.0',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_RATE || '0.1'),
      beforeSend(event) {
        // Sanitizar datos sensibles antes de enviar a Sentry
        if (event.request) {
          if (event.request.cookies) delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      }
    });

    // Wiring de Express (Sentry v8+)
    if (app && typeof Sentry.setupExpressErrorHandler === 'function') {
      Sentry.setupExpressErrorHandler(app);
    }

    sentryAvailable = true;
    logger.info('[Monitoring] Sentry inicializado correctamente');
  } catch (e) {
    logger.warn('[Monitoring] @sentry/node no instalado. Para activar: npm install @sentry/node');
  }
}

/**
 * Captura una excepción y la envía al monitoreo.
 */
function captureException(error, context = {}) {
  // Siempre loguear localmente
  logger.error('[Monitoring] Exception capturada', {
    message: error.message,
    ...context
  });

  if (sentryAvailable && Sentry) {
    Sentry.withScope(scope => {
      Object.entries(context).forEach(([key, val]) => {
        scope.setExtra(key, val);
      });
      Sentry.captureException(error);
    });
  }
}

/**
 * Captura un mensaje (warning, info, etc.)
 */
function captureMessage(message, level = 'info', context = {}) {
  if (sentryAvailable && Sentry) {
    Sentry.withScope(scope => {
      Object.entries(context).forEach(([key, val]) => {
        scope.setExtra(key, val);
      });
      Sentry.captureMessage(message, level);
    });
  }
}

/**
 * Middleware Express para capturar errores automáticamente.
 * Colocar ANTES del globalErrorHandler.
 */
function errorMiddleware() {
  return (err, req, res, next) => {
    captureException(err, {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userId: req.user?.id
    });
    next(err);
  };
}

module.exports = { init, captureException, captureMessage, errorMiddleware };
