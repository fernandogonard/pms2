// config/rateLimiterMonitor.js
// Sistema de monitoreo y testing de rate limiting
// Mejora técnica para verificación completa

const { logHelpers } = require('./logger');
const { productionLoggerConfig } = require('./productionLogger');

class RateLimiterMonitor {
  constructor() {
    this.metrics = {
      blocked: 0,
      total: 0,
      byEndpoint: {},
      byIP: {},
      lastReset: new Date()
    };
    
    this.setupMetricsCollection();
  }

  // Configurar recolección de métricas
  setupMetricsCollection() {
    // Reset métricas cada hora
    setInterval(() => {
      this.resetMetrics();
    }, 60 * 60 * 1000);
  }

  // Registrar un request bloqueado
  recordBlocked(ip, endpoint, rateLimitInfo) {
    this.metrics.blocked++;
    this.metrics.total++;
    
    // Por endpoint
    if (!this.metrics.byEndpoint[endpoint]) {
      this.metrics.byEndpoint[endpoint] = { blocked: 0, total: 0 };
    }
    this.metrics.byEndpoint[endpoint].blocked++;
    this.metrics.byEndpoint[endpoint].total++;
    
    // Por IP
    if (!this.metrics.byIP[ip]) {
      this.metrics.byIP[ip] = { blocked: 0, total: 0 };
    }
    this.metrics.byIP[ip].blocked++;
    this.metrics.byIP[ip].total++;

    // Log detallado
    logHelpers.security.rateLimitExceeded(ip, endpoint);
    
    productionLoggerConfig.logBusinessEvent('RATE_LIMIT_BLOCKED', {
      ip,
      endpoint,
      rateLimitInfo,
      totalBlocked: this.metrics.blocked,
      totalRequests: this.metrics.total
    }, null, 'warn');
  }

  // Registrar un request permitido
  recordAllowed(ip, endpoint) {
    this.metrics.total++;
    
    // Por endpoint
    if (!this.metrics.byEndpoint[endpoint]) {
      this.metrics.byEndpoint[endpoint] = { blocked: 0, total: 0 };
    }
    this.metrics.byEndpoint[endpoint].total++;
    
    // Por IP
    if (!this.metrics.byIP[ip]) {
      this.metrics.byIP[ip] = { blocked: 0, total: 0 };
    }
    this.metrics.byIP[ip].total++;
  }

  // Obtener métricas actuales
  getMetrics() {
    const uptime = Date.now() - this.metrics.lastReset.getTime();
    const blockedRate = this.metrics.total > 0 ? 
      (this.metrics.blocked / this.metrics.total * 100).toFixed(2) : 0;

    return {
      summary: {
        totalRequests: this.metrics.total,
        blockedRequests: this.metrics.blocked,
        allowedRequests: this.metrics.total - this.metrics.blocked,
        blockRate: `${blockedRate}%`,
        uptime: `${Math.round(uptime / 1000 / 60)} minutes`
      },
      byEndpoint: this.metrics.byEndpoint,
      topBlockedIPs: this.getTopBlockedIPs(),
      lastReset: this.metrics.lastReset
    };
  }

  // Obtener IPs más bloqueadas
  getTopBlockedIPs(limit = 10) {
    return Object.entries(this.metrics.byIP)
      .sort((a, b) => b[1].blocked - a[1].blocked)
      .slice(0, limit)
      .map(([ip, stats]) => ({
        ip,
        blocked: stats.blocked,
        total: stats.total,
        blockRate: `${(stats.blocked / stats.total * 100).toFixed(1)}%`
      }));
  }

  // Reset métricas
  resetMetrics() {
    const oldMetrics = { ...this.metrics };
    
    this.metrics = {
      blocked: 0,
      total: 0,
      byEndpoint: {},
      byIP: {},
      lastReset: new Date()
    };

    // Log resumen antes del reset
    productionLoggerConfig.logBusinessEvent('RATE_LIMIT_METRICS_RESET', {
      previousPeriod: {
        duration: Date.now() - oldMetrics.lastReset.getTime(),
        totalRequests: oldMetrics.total,
        blockedRequests: oldMetrics.blocked,
        blockRate: oldMetrics.total > 0 ? 
          (oldMetrics.blocked / oldMetrics.total * 100).toFixed(2) + '%' : '0%'
      },
      topBlockedEndpoints: Object.entries(oldMetrics.byEndpoint)
        .sort((a, b) => b[1].blocked - a[1].blocked)
        .slice(0, 5)
    }, null, 'info');
  }

  // Middleware para monitorear rate limiting
  middleware() {
    return (req, res, next) => {
      const originalSend = res.send;
      const self = this;
      
      res.send = function(data) {
        const endpoint = req.route ? req.route.path : req.path;
        
        if (res.statusCode === 429) {
          // Request bloqueado
          self.recordBlocked(req.ip, endpoint, {
            statusCode: res.statusCode,
            headers: res.getHeaders()
          });
        } else {
          // Request permitido
          self.recordAllowed(req.ip, endpoint);
        }
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
}

// Instancia global del monitor
const rateLimiterMonitor = new RateLimiterMonitor();

// Configurar logging periódico de métricas de rate limiting
const startRateLimitMetricsLogging = () => {
  setInterval(() => {
    const metrics = rateLimiterMonitor.getMetrics();
    
    if (metrics.summary.totalRequests > 0) {
      productionLoggerConfig.logBusinessEvent('RATE_LIMIT_METRICS', metrics, null, 'info');
    }
  }, 10 * 60 * 1000); // Cada 10 minutos
};

// Funciones de testing para rate limiting
const testRateLimit = {
  // Test básico de rate limiting
  async testEndpoint(baseUrl, endpoint, headers = {}, maxRequests = 10) {
    const results = {
      endpoint,
      totalRequests: 0,
      successfulRequests: 0,
      blockedRequests: 0,
      errors: [],
      timestamps: []
    };

    for (let i = 0; i < maxRequests; i++) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers
        });
        
        const endTime = Date.now();
        
        results.totalRequests++;
        results.timestamps.push({
          requestNumber: i + 1,
          timestamp: new Date().toISOString(),
          responseTime: endTime - startTime,
          statusCode: response.status
        });

        if (response.status === 429) {
          results.blockedRequests++;
        } else if (response.status < 400) {
          results.successfulRequests++;
        }
        
        // Pequeña pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        results.errors.push({
          requestNumber: i + 1,
          error: error.message
        });
      }
    }

    return results;
  },

  // Test de múltiples endpoints
  async testMultipleEndpoints(baseUrl, endpoints, headers = {}) {
    const results = {};
    
    for (const endpoint of endpoints) {
      console.log(`Testing rate limit for ${endpoint}...`);
      results[endpoint] = await this.testEndpoint(baseUrl, endpoint, headers, 20);
    }
    
    return results;
  },

  // Generar reporte de testing
  generateReport(testResults) {
    const report = {
      summary: {
        totalEndpoints: Object.keys(testResults).length,
        timestamp: new Date().toISOString()
      },
      details: {}
    };

    for (const [endpoint, results] of Object.entries(testResults)) {
      report.details[endpoint] = {
        totalRequests: results.totalRequests,
        successfulRequests: results.successfulRequests,
        blockedRequests: results.blockedRequests,
        blockRate: results.totalRequests > 0 ? 
          `${(results.blockedRequests / results.totalRequests * 100).toFixed(1)}%` : '0%',
        rateLimitWorking: results.blockedRequests > 0,
        errors: results.errors.length
      };
    }

    return report;
  }
};

module.exports = {
  RateLimiterMonitor,
  rateLimiterMonitor,
  startRateLimitMetricsLogging,
  testRateLimit
};