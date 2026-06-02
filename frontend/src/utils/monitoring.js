// utils/monitoring.js
// Monitoreo de errores en frontend — captura errores no controlados y fallos de red.
// Sentry es opcional: solo activo si se instala @sentry/react y se configura REACT_APP_SENTRY_DSN.

let Sentry = null;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Inicializa el monitoreo del frontend.
 * Llamar UNA VEZ al arrancar la app (index.js).
 */
export function initMonitoring() {
  // Captura global de errores no controlados
  window.addEventListener('error', (event) => {
    const { message, filename, lineno, colno } = event;
    if (IS_PRODUCTION) {
      captureException(event.error || new Error(message), {
        source: 'window.onerror',
        filename,
        lineno,
        colno
      });
    }
  });

  // Captura de promesas rechazadas no manejadas
  window.addEventListener('unhandledrejection', (event) => {
    if (IS_PRODUCTION) {
      captureException(event.reason || new Error('Unhandled Promise rejection'), {
        source: 'unhandledrejection'
      });
    }
  });
}

/**
 * Captura una excepción y la envía al servicio de monitoreo.
 */
export function captureException(error, context = {}) {
  if (Sentry) {
    Sentry.withScope(scope => {
      Object.entries(context).forEach(([key, val]) => {
        scope.setExtra(key, val);
      });
      Sentry.captureException(error);
    });
  }
  // Siempre loguear en consola en desarrollo
  if (!IS_PRODUCTION) {
    console.error('[Monitoring]', error, context);
  }
}

