const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

// Descubre dinámicamente el puerto backend desde port.txt o env para evitar proxies rotos cuando el backend salta de 5000 a otro puerto
const portFile = path.resolve(__dirname, '../backend/port.txt');
const fallbackPort = process.env.BACKEND_PORT || '5000';
const getBackendPort = () => {
  try {
    const raw = fs.readFileSync(portFile, 'utf8').trim();
    return raw || fallbackPort;
  } catch (err) {
    return fallbackPort;
  }
};

const buildTarget = () => `http://localhost:${getBackendPort()}`;

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
      target: buildTarget(),
      router: buildTarget,
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
      target: buildTarget(),
      router: buildTarget,
      ws: true,
      changeOrigin: true
    })
  );
  
  // Middleware para agregar cabeceras solo a navegaciones HTML, no a assets estáticos
  app.use((req, res, next) => {
    const isApi = req.url.startsWith('/api');
    const isWs = req.url.startsWith('/ws');
    const isAsset = /\.[a-zA-Z0-9]+$/.test(req.path);
    const acceptsHtml = (req.headers.accept || '').includes('text/html');

    if (!isApi && !isWs && !isAsset && acceptsHtml) {
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