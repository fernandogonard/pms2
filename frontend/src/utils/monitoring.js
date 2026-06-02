// utils/monitoring.js
// Monitoreo de errores en frontend — captura errores no controlados y fallos de red.
// Activado SOLO si REACT_APP_SENTRY_DSN está configurado (Sentry) o siempre para logging local.

let Sentry = null;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Inicializa el monitoreo del frontend.
 * Llamar UNA VEZ al arrancar la app (index.js).
 */
export function initMonitoring() {
  // Si hay DSN de Sentry, intentar cargar @sentry/react
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (dsn) {
    try {
      // Dynamic import no disponible fácil en CRA sync context;
      // se asume @sentry/react instalado si se configura DSN
      Sentry = require('@sentry/react');
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
        beforeSend(event) {
          // No enviar errores de red comunes (usuario offline, etc.)
          if (event.exception?.values?.[0]?.value?.includes('Failed to fetch')) {
            return null;
          }
          return event;
        }
      });
    } catch {
      // @sentry/react no instalado — continuar sin él
    }
  }

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
