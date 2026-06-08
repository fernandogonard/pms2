// utils/cookieHelper.js
// Helpers para manejar httpOnly cookies de autenticación

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ENABLE_PARTITIONED_COOKIE = process.env.ENABLE_PARTITIONED_COOKIE === 'true';

function buildCookieOptions() {
  const options = {
    httpOnly: true,
    secure: IS_PRODUCTION,                    // Solo HTTPS en producción
    sameSite: IS_PRODUCTION ? 'none' : 'lax', // 'none' para cross-origin (Vercel -> backend)
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000          // 7 días (igual que refreshToken TTL)
  };

  // CHIPS/Partitioned: habilitar solo si el entorno lo pide explícitamente.
  if (ENABLE_PARTITIONED_COOKIE) {
    options.partitioned = true;
  }

  return options;
}

/**
 * Setea el refresh token como cookie httpOnly en la respuesta.
 */
function setRefreshTokenCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, buildCookieOptions());
}

/**
 * Limpia la cookie del refresh token.
 */
function clearRefreshTokenCookie(res) {
  const clearOptions = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    path: '/'
  };

  if (ENABLE_PARTITIONED_COOKIE) {
    clearOptions.partitioned = true;
  }

  res.clearCookie('refreshToken', clearOptions);
}

module.exports = { setRefreshTokenCookie, clearRefreshTokenCookie };
