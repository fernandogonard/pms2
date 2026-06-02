// middlewares/csrfProtection.js
// Verificación de Origin para requests mutantes (defense-in-depth contra CSRF)
//
// Contexto de seguridad:
// - Los endpoints autenticados ya están protegidos contra CSRF porque requieren
//   Authorization: Bearer <token> y el token vive SOLO en memoria JS (no en cookie).
// - El único endpoint que depende exclusivamente de una cookie es /refresh-token.
// - Este middleware añade una capa adicional verificando el header Origin/Referer.

const { logger } = require('../services/loggerService');

function csrfOriginVerification(req, res, next) {
  // Solo verificar métodos que mutan estado
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Si no hay Origin ni Referer, es un cliente no-navegador (curl, Postman, mobile nativo).
  // Estos se autentican por Bearer token, así que no son vulnerables a CSRF.
  if (!origin && !referer) return next();

  // Extraer el origin efectivo
  let requestOrigin;
  try {
    requestOrigin = origin || new URL(referer).origin;
  } catch {
    // Referer malformado — rechazar
    return res.status(403).json({ success: false, message: 'Origen no válido' });
  }

  const normalizedOrigin = requestOrigin.replace(/\/$/, '');

  // Validar contra orígenes permitidos (misma lógica que CORS)
  const allowedRaw = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const allowedOrigins = allowedRaw.split(',').map(s => s.trim().replace(/\/$/, ''));

  const isAllowed =
    allowedOrigins.includes(normalizedOrigin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(normalizedOrigin) ||
    (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin));

  if (isAllowed) return next();

  logger.security.anomaly('CSRF: origin mismatch en request mutante', {
    origin: requestOrigin,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  return res.status(403).json({ success: false, message: 'Origen no permitido' });
}

module.exports = { csrfOriginVerification };
