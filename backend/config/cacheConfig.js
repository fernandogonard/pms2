// config/cacheConfig.js
// Sistema de caché avanzado enterprise

const Redis = require('ioredis');
const NodeCache = require('node-cache');

class CacheManager {
  constructor() {
    // Configurar Redis para producción, memoria para desarrollo
    this.isProduction = process.env.NODE_ENV === 'production';
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    if (this.isProduction) {
      this.redis = new Redis(this.redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000
      });
      
      this.redis.on('error', (err) => {
        console.error('Redis error:', err);
      });
    } else {
      // Cache en memoria para desarrollo
      this.memoryCache = new NodeCache({
        stdTTL: 600, // 10 minutos por defecto
        checkperiod: 120, // verificar expirados cada 2 minutos
        useClones: false
      });
    }
  }

  async get(key) {
    try {
      if (this.isProduction && this.redis) {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        return this.memoryCache.get(key) || null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 600) {
    try {
      if (this.isProduction && this.redis) {
        await this.redis.setex(key, ttl, JSON.stringify(value));
      } else {
        this.memoryCache.set(key, value, ttl);
      }
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      if (this.isProduction && this.redis) {
        await this.redis.del(key);
      } else {
        this.memoryCache.del(key);
      }
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async clear() {
    try {
      if (this.isProduction && this.redis) {
        await this.redis.flushall();
      } else {
        this.memoryCache.flushAll();
      }
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  // Generar clave de caché
  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  // Cache con expiración basada en tiempo
  async getOrSet(key, fetcher, ttl = 600) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  // Invalidar cache por patrón
  async invalidatePattern(pattern) {
    try {
      if (this.isProduction && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        const keys = this.memoryCache.keys();
        keys.forEach(key => {
          if (key.includes(pattern.replace('*', ''))) {
            this.memoryCache.del(key);
          }
        });
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}

// Middleware de caché para endpoints
const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    const key = keyGenerator 
      ? keyGenerator(req) 
      : `api:${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;

    const cached = await cacheManager.get(key);
    if (cached) {
      return res.json(cached);
    }

    // Interceptar res.json para cachear la respuesta
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode === 200) {
        cacheManager.set(key, data, ttl);
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

const cacheManager = new CacheManager();

module.exports = {
  cacheManager,
  cacheMiddleware
};