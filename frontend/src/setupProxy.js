const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Configuración de proxy para desarrollo
 * IMPORTANTE: Se eliminó "proxy": "http://localhost:5000" del package.json
 * para evitar que todas las solicitudes sean enviadas al backend.
 * Solo las rutas /api y /ws se enviarán al backend.
 */
module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      // No hacer pathRewrite - mantener /api en la URL
      // El backend espera /api/stats/rooms, no /stats/rooms
    })
  );

  // Proxy para WebSocket
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      ws: true,
    })
  );
};