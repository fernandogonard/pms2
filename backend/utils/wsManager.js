const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { logger } = require('../services/loggerService');

/**
 * WebSocket Manager
 * - 1 conexión por usuario
 * - Pool centralizado
 * - Broadcast con deduplicación
 * - Heartbeat automático
 */

class WSManager {
  constructor() {
    this.clients = new Map();
    this.heartbeatInterval = 30000; // 30s
  }

  init(server) {
    const wss = new WebSocket.Server({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
      const token = req.url.split('token=')[1];
      if (!token) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        this.clients.set(userId, ws);

        ws.on('message', (message) => {
          // Handle incoming messages if needed
        });

        ws.on('close', () => {
          this.clients.delete(userId);
        });

        ws.on('error', (error) => {
          logger.error('WS Error', error);
          this.clients.delete(userId);
        });

        // Heartbeat
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          } else {
            clearInterval(heartbeat);
          }
        }, this.heartbeatInterval);

        ws.on('pong', () => {
          // Keep alive
        });

      } catch (error) {
        ws.close(1008, 'Invalid token');
      }
    });
  }

  broadcastToUser(userId, message) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  closeAll() {
    this.clients.forEach(ws => {
      try {
        ws.close();
      } catch (error) {
        // Force close if needed
        ws.terminate();
      }
    });
    this.clients.clear();
  }
}

module.exports = new WSManager();
