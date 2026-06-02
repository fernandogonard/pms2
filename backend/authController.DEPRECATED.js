// authController.js
// Controlador para manejar autenticación y autorización

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('./models/User'); // Modelo de usuario
const { logger } = require('./config/logger');
const redis = require('redis');
const client = redis.createClient();

client.on('error', (err) => {
  console.error('Redis error:', err);
});

// Clave secreta para firmar tokens
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'defaultAccessSecret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'defaultRefreshSecret';

// Almacenamiento temporal de Refresh Tokens (debe ser persistente en producción)
let refreshTokens = [];

// Generar Access Token
const generateAccessToken = (user) => {
  return jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
};

// Generar Refresh Token
const generateRefreshToken = (user) => {
  const refreshToken = jwt.sign(user, REFRESH_TOKEN_SECRET);
  refreshTokens.push(refreshToken);
  return refreshToken;
};

// Login del usuario
const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const userPayload = { id: user._id, username: user.username };
    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    res.json({ accessToken, refreshToken });
  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Rotación de Refresh Tokens
const rotateRefreshToken = async (oldToken, userPayload) => {
  try {
    // Invalidar el token antiguo
    await blacklistToken(oldToken);

    // Generar un nuevo Refresh Token
    const newRefreshToken = generateRefreshToken(userPayload);

    return newRefreshToken;
  } catch (error) {
    logger.error('Error al rotar Refresh Token:', error);
    throw error;
  }
};

// Renovar Access Token
const refreshAccessToken = async (req, res) => {
  const { token } = req.body;
  if (!token || await isTokenBlacklisted(token)) {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }

  jwt.verify(token, REFRESH_TOKEN_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    try {
      const newRefreshToken = await rotateRefreshToken(token, { id: user.id, username: user.username });
      const accessToken = generateAccessToken({ id: user.id, username: user.username });

      res.json({ accessToken, refreshToken: newRefreshToken });
    } catch (error) {
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
};

// Lista negra persistente
const blacklistToken = async (token) => {
  try {
    await client.set(token, 'blacklisted', 'EX', 60 * 60 * 24 * 7); // Expira en 7 días
  } catch (err) {
    console.error('Error al agregar token a la lista negra:', err);
  }
};

const isTokenBlacklisted = async (token) => {
  try {
    const result = await client.get(token);
    return result === 'blacklisted';
  } catch (err) {
    console.error('Error al verificar lista negra:', err);
    return false;
  }
};

// Logout del usuario
const logout = async (req, res) => {
  const { token } = req.body;
  try {
    await blacklistToken(token);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Error al cerrar sesión' });
  }
};

module.exports = {
  login,
  refreshAccessToken,
  logout,
  blacklistToken,
  isTokenBlacklisted,
};