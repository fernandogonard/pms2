// middlewares/authMiddleware.js
// Middleware para verificar JWT y roles

const jwt = require('jsonwebtoken');
const authService = require('../services/authService');

// Verifica si el usuario está autenticado (obligatorio)
exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado, token faltante.' });
  }
  const token = authHeader.split(' ')[1];

  // Verificar blacklist antes de validar el JWT
  if (authService.isTokenBlacklisted(token)) {
    return res.status(401).json({ message: 'Token revocado. Por favor inicie sesión nuevamente.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido.' });
  }
};

// Verifica si el usuario está autenticado (opcional, para rutas públicas)
exports.protectOptional = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (!authService.isTokenBlacklisted(token)) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      } catch (error) {
        // Token inválido, ignorar y seguir como público
      }
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
