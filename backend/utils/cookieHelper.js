// utils/cookieHelper.js
// Helpers para manejar httpOnly cookies de autenticación

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,                    // Solo HTTPS en producción
  sameSite: IS_PRODUCTION ? 'none' : 'lax', // 'none' para cross-origin (Vercel → Railway)
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000          // 7 días (igual que refreshToken TTL)
};

/**
 * Setea el refresh token como cookie httpOnly en la respuesta.
 */
function setRefreshTokenCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
}

/**
 * Limpia la cookie del refresh token.
 */
function clearRefreshTokenCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    path: '/'
  });
}

module.exports = { setRefreshTokenCookie, clearRefreshTokenCookie };
