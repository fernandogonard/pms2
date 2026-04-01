// utils/wsClient.js
// Pequeño cliente WebSocket con reconexión exponencial y API simple

/**
 * WebSocket Client
 * - URL FIJA desde env
 * - Reconexión exponencial
 * - Heartbeat
 * - Sin duplicación
 */

class WSClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Set();
    this.heartbeatInterval = null;
  }

  connect(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${this.url}?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.listeners.forEach(listener => listener(data));
      } catch (error) {
        console.error('WS Message parse error:', error);
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect(token);
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WS Error:', error);
    };
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        this.ws = null;
      }
    }
    this.stopHeartbeat();
  }
}

export default WSClient;
export const createWSConnection = (url) => new WSClient(url);
