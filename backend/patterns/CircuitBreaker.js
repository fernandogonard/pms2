// patterns/CircuitBreaker.js
// Patrón Circuit Breaker para resiliencia enterprise

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minuto
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 segundos
    this.expectedErrorCode = options.expectedErrorCode || 500;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    
    this.onStateChange = options.onStateChange || (() => {});
    this.logger = options.logger || console;
  }

  async execute(operation, fallback = null) {
    if (this.state === 'OPEN') {
      if (this.nextAttempt && Date.now() < this.nextAttempt) {
        this.logger.warn('Circuit breaker OPEN, executing fallback');
        return fallback ? fallback() : this.getFallbackResponse();
      } else {
        this.state = 'HALF_OPEN';
        this.onStateChange('HALF_OPEN');
        this.logger.info('Circuit breaker transitioning to HALF_OPEN');
      }
    }

    this.requests++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  onSuccess() {
    this.successes++;
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.onStateChange('CLOSED');
      this.logger.info('Circuit breaker transitioned to CLOSED');
    }
  }

  onFailure(error) {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    this.logger.error(`Circuit breaker failure ${this.failures}/${this.failureThreshold}:`, error.message);

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.recoveryTimeout;
      this.onStateChange('OPEN');
      this.logger.warn(`Circuit breaker OPEN, next attempt at ${new Date(this.nextAttempt)}`);
    }
  }

  getFallbackResponse() {
    return {
      success: false,
      message: 'Servicio temporalmente no disponible',
      error: 'CIRCUIT_BREAKER_OPEN',
      retryAfter: this.nextAttempt ? Math.ceil((this.nextAttempt - Date.now()) / 1000) : 60
    };
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      failureRate: this.requests > 0 ? (this.failures / this.requests) : 0,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.onStateChange('CLOSED');
    this.logger.info('Circuit breaker reset to CLOSED');
  }
}

// Factory para crear circuit breakers específicos
class CircuitBreakerFactory {
  constructor() {
    this.breakers = new Map();
  }

  create(name, options = {}) {
    if (this.breakers.has(name)) {
      return this.breakers.get(name);
    }

    const breaker = new CircuitBreaker({
      ...options,
      onStateChange: (state) => {
        console.log(`Circuit breaker '${name}' changed to ${state}`);
        if (options.onStateChange) {
          options.onStateChange(state);
        }
      }
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  get(name) {
    return this.breakers.get(name);
  }

  getAll() {
    const stats = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Middleware para Express con circuit breaker
const circuitBreakerMiddleware = (name, options = {}) => {
  const factory = new CircuitBreakerFactory();
  const breaker = factory.create(name, {
    failureThreshold: 3,
    recoveryTimeout: 30000,
    ...options
  });

  return async (req, res, next) => {
    try {
      await breaker.execute(async () => {
        return new Promise((resolve, reject) => {
          res.on('finish', () => {
            if (res.statusCode >= 500) {
              reject(new Error(`HTTP ${res.statusCode}`));
            } else {
              resolve();
            }
          });
          next();
        });
      }, () => {
        // Fallback response
        res.status(503).json(breaker.getFallbackResponse());
      });
    } catch (error) {
      res.status(503).json(breaker.getFallbackResponse());
    }
  };
};

module.exports = {
  CircuitBreaker,
  CircuitBreakerFactory,
  circuitBreakerMiddleware
};