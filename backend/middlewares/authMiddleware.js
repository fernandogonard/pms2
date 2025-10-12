// middlewares/authMiddleware.js
// Middleware para verificar JWT y roles

const jwt = require('jsonwebtoken');

// Verifica si el usuario está autenticado (obligatorio)
exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Log ligero para depuración: header ausente o mal formado
    console.log(`[AUTH] Solicitud sin Authorization header: ${req.method} ${req.originalUrl} from ${req.ip || req.connection.remoteAddress}`);
    return res.status(401).json({ message: 'No autorizado, token faltante.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // Log del fallo de verificación para facilitar diagnóstico (no imprimir token)
    console.log(`[AUTH] Token inválido para ${req.method} ${req.originalUrl}: ${error.message}`);
    res.status(401).json({ message: 'Token inválido.' });
  }
};

// Verifica si el usuario está autenticado (opcional, para rutas públicas)
exports.protectOptional = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Token inválido, ignorar y seguir como público — registrar para depuración
      console.log(`[AUTH] protectOptional: token inválido en ${req.method} ${req.originalUrl}: ${error.message}`);
    }
  }
  next();
};

// Verifica si el usuario tiene el rol requerido
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes permiso para esta acción.' });
    }
    next();
  };
};
