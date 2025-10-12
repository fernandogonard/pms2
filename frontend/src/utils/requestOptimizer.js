// frontend/src/utils/requestOptimizer.js  
// Optimizador de requests para evitar duplicados y mejorar rendimiento

class RequestOptimizer {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.cacheTimeout = 30000; // 30 segundos
    this.rateLimitMap = new Map();
    this.rateLimitWindow = 1000; // 1 segundo
    this.maxRequestsPerWindow = 5;
  }

  // Cache con TTL
  setCache(key, data, ttl = this.cacheTimeout) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
    
    // Limpiar cache expirado automáticamente
    setTimeout(() => {
      const cached = this.cache.get(key);
      if (cached && cached.expiry <= Date.now()) {
        this.cache.delete(key);
      }
    }, ttl);
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (cached.expiry <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  // Rate limiting por endpoint
  checkRateLimit(endpoint) {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    if (!this.rateLimitMap.has(endpoint)) {
      this.rateLimitMap.set(endpoint, []);
    }
    
    const requests = this.rateLimitMap.get(endpoint);
    
    // Limpiar requests antiguos
    const recentRequests = requests.filter(time => time > windowStart);
    this.rateLimitMap.set(endpoint, recentRequests);
    
    if (recentRequests.length >= this.maxRequestsPerWindow) {
      return false; // Rate limited
    }
    
    recentRequests.push(now);
    return true;
  }

  // Deduplicación de requests pendientes
  async request(endpoint, options = {}) {
    const cacheKey = this.generateCacheKey(endpoint, options);
    
    // Verificar cache primero
    const cached = this.getCache(cacheKey);
    if (cached && !options.skipCache) {
      return Promise.resolve(cached);
    }

    // Verificar rate limiting
    if (!this.checkRateLimit(endpoint)) {
      throw new Error(`Rate limit exceeded for ${endpoint}`);
    }

    // Si ya hay un request pendiente para este endpoint, devolver la misma promesa
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Crear nuevo request
    const requestPromise = this.executeRequest(endpoint, options)
      .then(response => {
        // Guardar en cache solo si es exitoso
        if (response.ok || response.success) {
          this.setCache(cacheKey, response);
        }
        return response;
      })
      .catch(error => {
        // No cachear errores
        throw error;
      })
      .finally(() => {
        // Limpiar request pendiente
        this.pendingRequests.delete(cacheKey);
      });

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  generateCacheKey(endpoint, options) {
    const method = options.method || 'GET';
    const body = options.body || '';
    const params = new URLSearchParams(options.params || {}).toString();
    return `${method}:${endpoint}:${params}:${body}`;
  }

  async executeRequest(endpoint, options) {
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
    const url = `${baseURL}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include',
      ...options
    };

    // Añadir token de autorización si está disponible
    const token = localStorage.getItem('token');
    if (token) {
      defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Limpiar cache manualmente
  clearCache(pattern) {
    if (pattern) {
      const keys = Array.from(this.cache.keys());
      keys.forEach(key => {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      });
    } else {
      this.cache.clear();
    }
  }

  // Precargar datos comunes
  async preloadCommonData() {
    try {
      const commonEndpoints = [
        '/api/rooms',
        '/api/users',
        '/api/clients?q='
      ];

      const preloadPromises = commonEndpoints.map(endpoint => 
        this.request(endpoint, { skipCache: false })
          .catch(error => {
            console.warn(`Preload failed for ${endpoint}:`, error);
            return null;
          })
      );

      await Promise.allSettled(preloadPromises);
      console.log('Common data preloaded successfully');
    } catch (error) {
      console.error('Error preloading common data:', error);
    }
  }

  // Batch requests para optimizar múltiples llamadas
  async batchRequest(requests) {
    const results = [];
    const chunks = this.chunkArray(requests, 3); // Máximo 3 requests paralelos

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(({ endpoint, options }) => 
        this.request(endpoint, options)
          .catch(error => ({ error: error.message, endpoint }))
      );
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Invalidar cache por patrón
  invalidateCache(patterns) {
    if (!Array.isArray(patterns)) {
      patterns = [patterns];
    }

    patterns.forEach(pattern => {
      const keys = Array.from(this.cache.keys());
      keys.forEach(key => {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      });
    });
  }

  // Estadísticas de uso
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      rateLimitEntries: this.rateLimitMap.size,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  calculateCacheHitRate() {
    // Esta sería una implementación más compleja en producción
    return 'Not implemented';
  }
}

// Instancia singleton
const requestOptimizer = new RequestOptimizer();

// Hook personalizado para usar el optimizador
export const useOptimizedRequest = () => {
  const request = async (endpoint, options) => {
    return requestOptimizer.request(endpoint, options);
  };

  const clearCache = (pattern) => {
    requestOptimizer.clearCache(pattern);
  };

  const invalidateCache = (patterns) => {
    requestOptimizer.invalidateCache(patterns);
  };

  const batchRequest = (requests) => {
    return requestOptimizer.batchRequest(requests);
  };

  const preloadCommonData = () => {
    return requestOptimizer.preloadCommonData();
  };

  const getStats = () => {
    return requestOptimizer.getStats();
  };

  return {
    request,
    clearCache,
    invalidateCache,
    batchRequest,
    preloadCommonData,
    getStats
  };
};

export default requestOptimizer;