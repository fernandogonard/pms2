const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Configuración de proxy para desarrollo
 * IMPORTANTE: Se eliminó "proxy": "http://localhost:5000" del package.json
 * para evitar que todas las solicitudes sean enviadas al backend.
 * Solo las rutas /api y /ws se enviarán al backend.
 */
module.exports = function(app) {
  // Proxy solo para rutas /api
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      secure: false,
      logLevel: 'info',
      onProxyRes: function (proxyRes, req, res) {
        // Agregar cabeceras de seguridad y codificación
        proxyRes.headers['Content-Type'] = proxyRes.headers['content-type'] || 'application/json; charset=utf-8';
        proxyRes.headers['X-Content-Type-Options'] = 'nosniff';
        proxyRes.headers['X-Frame-Options'] = 'SAMEORIGIN';
        proxyRes.headers['X-XSS-Protection'] = '1; mode=block';
        proxyRes.headers['Charset'] = 'utf-8';
      },
      onError: function (err, req, res) {
        console.log('Proxy Error:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json; charset=utf-8'
        });
        res.end(JSON.stringify({
          error: 'Proxy Error',
          message: 'No se pudo conectar al servidor backend'
        }));
      }
    })
  );
  
  // Proxy específico para WebSockets
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      ws: true,
      changeOrigin: true
    })
  );
  
  // Middleware para establecer cabeceras de codificación en todas las respuestas
  app.use('*', (req, res, next) => {
    // Solo agregar cabeceras si no es una solicitud de API o WS
    if (!req.url.startsWith('/api') && !req.url.startsWith('/ws')) {
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Charset': 'utf-8'
      });
    }
    next();
  });

  // Interceptar solicitudes de hot-update para evitar que lleguen al backend
  app.use((req, res, next) => {
    if (req.url.includes('.hot-update.json') || req.url.includes('.hot-update.js')) {
      console.log('[Dev Server] Interceptada solicitud hot-update:', req.url);
      res.status(204).end();
      return;
    }
    next();
  });
};