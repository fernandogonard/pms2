# PLAN IMPLEMENTACIÓN: Producción Ready (PMS2)

**Objetivo:** 6 implementaciones sin nuevas features  
**Scope:** Robustez, observabilidad, auditoría, confiabilidad  
**Timeline:** 12 días (~2 sprints)

---

## PASO 1: Health Endpoint (Hoy - Mañana, 2 días)

### Objetivo
- Endpoint GET /api/system/health retorna JSON con estado del sistema
- Usado por load balancer, monitoring, alerting
- Pre-requisito para producción

### Implementación Detallada

**1.1 Crear `backend/controllers/healthController.js`**

```javascript
// NEW FILE: backend/controllers/healthController.js
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const { resolveAppMode } = require('../services/appModeService');

const startTime = Date.now();
const metrics = {
  errorCount: 0,
  lastError: null,
  requestCount: 0
};

exports.health = async (req, res) => {
  try {
    const now = Date.now();
    const uptime = Math.floor((now - startTime) / 1000);
    
    // Verificar conexión MongoDB
    const dbHealth = await verifyDatabase();
    
    // Contar reservas activas (últimas 24h)
    const appMode = resolveAppMode(req);
    const recentReservations = await Reservation.countDocuments({
      mode: appMode,
      createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) }
    }).lean();
    
    // Contar habitaciones disponibles
    const availableRooms = await Room.countDocuments({
      mode: appMode,
      status: 'disponible'
    }).lean();
    
    // Calcular error rate (últimos 5 minutos)
    const errorRate = (metrics.errorCount / Math.max(metrics.requestCount, 1) * 100).toFixed(2);
    
    // Determinar estado general
    let status = 'healthy';
    if (!dbHealth.ok || errorRate > 5) status = 'degraded';
    if (!dbHealth.ok) status = 'down';
    
    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: uptime,
      components: {
        database: dbHealth.ok ? 'OK' : 'ERROR',
        websocket: 'OK', // TODO: verificar WS server
        availability_engine: 'OK' // TODO: verificar motor
      },
      metrics: {
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptime_seconds: uptime,
        recent_reservations: recentReservations,
        available_rooms: availableRooms,
        error_rate_percent: parseFloat(errorRate),
        total_requests: metrics.requestCount
      },
      mode: appMode
    });
    
    metrics.requestCount++;
  } catch (error) {
    metrics.errorCount++;
    metrics.lastError = error.message;
    
    res.status(503).json({
      status: 'down',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

async function verifyDatabase() {
  try {
    // Intentar conexión simple
    await mongoose.connection.db.admin().ping();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Incrementar contadores en cada request
exports.recordRequest = (req, res, next) => {
  metrics.requestCount++;
  next();
};

exports.recordError = (error) => {
  metrics.errorCount++;
  metrics.lastError = error.message;
};

module.exports = exports;
```

**1.2 Agregar ruta en `backend/app.js`**

```javascript
// En app.js, después de otros routes:

const healthController = require('./controllers/healthController');

// Health endpoint (público, sin auth)
app.get('/api/system/health', healthController.health);

// Middleware para tracking
app.use(healthController.recordRequest);

// En error middleware, agregar:
const { recordError } = require('./controllers/healthController');
// ... cuando ocurra error:
recordError(error);
```

**1.3 Crear test en `backend/tests/unit/healthController.test.js`**

```javascript
// NEW FILE: backend/tests/unit/healthController.test.js
const healthController = require('../../controllers/healthController');
const mongoose = require('mongoose');
const Room = require('../../models/Room');
const Reservation = require('../../models/Reservation');

describe('Health Controller', () => {
  it('should return healthy status when DB is OK', async () => {
    const req = { headers: { 'x-app-mode': 'demo' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    await healthController.health(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('healthy');
    expect(body.components.database).toBe('OK');
  });
  
  it('should include uptime and metrics', async () => {
    const req = { headers: { 'x-app-mode': 'demo' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    await healthController.health(req, res);
    
    const body = res.json.mock.calls[0][0];
    expect(body.metrics).toHaveProperty('memory_mb');
    expect(body.metrics).toHaveProperty('uptime_seconds');
    expect(body.metrics).toHaveProperty('recent_reservations');
    expect(body.metrics).toHaveProperty('available_rooms');
  });
  
  it('should track request count', async () => {
    const req = { headers: { 'x-app-mode': 'demo' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();
    
    const beforeCount = (await healthController.health(req, res)).requestCount || 0;
    healthController.recordRequest(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });
});
```

**1.4 Validar**

```bash
cd backend
npm test -- healthController.test.js
curl http://localhost:3001/api/system/health
# Debe retornar JSON con status y métricas
```

---

## PASO 2: Memory Leak Fix (Día 3, 2 días)

### Objetivo
- Eliminar setInterval sin cleanup
- Eliminar process listeners acumulados
- Jest test debe terminar sin "open handles"

### Identificación exacta

```
❌ Leak 1: config/rateLimiterMonitor.js:24 setInterval sin cleanup
❌ Leak 2: config/rateLimiterMonitor.js:170 setInterval sin cleanup
⚠️  Leak 3: config/productionLogger.js:207 setInterval sin cleanup
⚠️  Leak 4: process.on() listeners sin removeListener
```

### Implementación

**2.1 Crear `backend/services/gracefulShutdown.js`**

```javascript
// NEW FILE: backend/services/gracefulShutdown.js
class GracefulShutdownManager {
  constructor() {
    this.resources = new Map();
    this.handlers = [];
  }
  
  registerInterval(name, intervalId) {
    this.resources.set(name, { type: 'interval', id: intervalId });
  }
  
  registerListener(name, event, callback) {
    this.resources.set(name, { type: 'listener', event, callback });
  }
  
  registerHandler(handler) {
    this.handlers.push(handler);
  }
  
  async shutdown(signal) {
    console.log(`[GRACEFUL SHUTDOWN] Signal ${signal} recibido...`);
    
    // Limpiar intervals
    for (const [name, resource] of this.resources) {
      if (resource.type === 'interval') {
        clearInterval(resource.id);
        console.log(`[GRACEFUL SHUTDOWN] ✓ Interval ${name} limpiado`);
      }
      if (resource.type === 'listener') {
        process.removeListener(resource.event, resource.callback);
        console.log(`[GRACEFUL SHUTDOWN] ✓ Listener ${name} removido`);
      }
    }
    
    // Ejecutar handlers
    for (const handler of this.handlers) {
      try {
        await handler();
      } catch (error) {
        console.error(`[GRACEFUL SHUTDOWN] Error en handler:`, error);
      }
    }
    
    console.log('[GRACEFUL SHUTDOWN] Complete');
    process.exit(0);
  }
}

const manager = new GracefulShutdownManager();

// Registrar signals
process.on('SIGTERM', () => manager.shutdown('SIGTERM'));
process.on('SIGINT', () => manager.shutdown('SIGINT'));

module.exports = manager;
```

**2.2 Actualizar `backend/config/rateLimiterMonitor.js`**

```javascript
// CAMBIO EN: config/rateLimiterMonitor.js

const gracefulShutdown = require('../services/gracefulShutdown');

class RateLimiterMonitor {
  constructor() {
    this.metrics = { /* ... */ };
    this.intervalHandles = []; // NUEVO
    this.setupMetricsCollection();
  }
  
  setupMetricsCollection() {
    // Reset métricas cada hora
    const handle1 = setInterval(() => {
      this.resetMetrics();
    }, 60 * 60 * 1000);
    this.intervalHandles.push(handle1);
    gracefulShutdown.registerInterval('rateLimiter.metricsReset', handle1);
    
    // Logging cada 5 min
    const handle2 = setInterval(() => {
      this.logMetrics();
    }, 5 * 60 * 1000);
    this.intervalHandles.push(handle2);
    gracefulShutdown.registerInterval('rateLimiter.metricsLog', handle2);
  }
  
  // NUEVO: Limpiar en test
  cleanup() {
    for (const handle of this.intervalHandles) {
      clearInterval(handle);
    }
    this.intervalHandles = [];
  }
  
  // ... resto del código
}

module.exports = new RateLimiterMonitor();
```

**2.3 Actualizar `backend/config/productionLogger.js`**

```javascript
// CAMBIO EN: config/productionLogger.js

const gracefulShutdown = require('../services/gracefulShutdown');

// ... en setupMetricsReporting():

const handle = setInterval(() => {
  // send metrics
}, 60 * 1000);

gracefulShutdown.registerInterval('productionLogger.metrics', handle);

// ... process listeners:

const uncaughtHandler = (error) => {
  logHelpers.error('uncaughtException', error);
};
process.on('uncaughtException', uncaughtHandler);
gracefulShutdown.registerListener('uncaughtException', 'uncaughtException', uncaughtHandler);

const rejectionHandler = (reason) => {
  logHelpers.error('unhandledRejection', reason);
};
process.on('unhandledRejection', rejectionHandler);
gracefulShutdown.registerListener('unhandledRejection', 'unhandledRejection', rejectionHandler);
```

**2.4 Test actualizado `backend/tests/unit/memoryLeak.test.js`**

```javascript
// NEW FILE: backend/tests/unit/memoryLeak.test.js
const rateLimiter = require('../../config/rateLimiterMonitor');
const gracefulShutdown = require('../../services/gracefulShutdown');

describe('Memory Leak Prevention', () => {
  afterEach(() => {
    // Limpiar todos los intervals
    rateLimiter.cleanup();
  });
  
  it('should cleanup intervals on shutdown', (done) => {
    const spy = jest.spyOn(global, 'clearInterval');
    
    rateLimiter.cleanup();
    
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    done();
  });
  
  it('should manage process listeners', () => {
    const listeners = process.eventNames();
    // Debe haber solo algunos listeners, no 100+
    expect(listeners.length).toBeLessThan(10);
  });
});
```

**2.5 Validar**

```bash
cd backend
npm test -- memoryLeak.test.js

# Verificar que Jest NO dice "open handles":
# ✓ Sin "jest did not exit" warning
```

---

## PASO 3: Error Handling Robusto (Día 5, 2 días)

### Objetivo
- Todos los endpoints con try-catch explícito
- Standardized error responses
- Error tracking (logging)

### Implementación

**3.1 Crear `backend/services/errorTracker.js`**

```javascript
// NEW FILE: backend/services/errorTracker.js
const { logHelpers } = require('../config/logger');

class ErrorTracker {
  constructor() {
    this.errors = [];
    this.maxErrors = 1000;
  }
  
  track(error, context) {
    const entry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      severity: this.calculateSeverity(error)
    };
    
    this.errors.push(entry);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    
    logHelpers.error('Application Error', error, context);
  }
  
  calculateSeverity(error) {
    if (error.statusCode === 409) return 'INFO';
    if (error.statusCode === 404) return 'INFO';
    if (error.statusCode < 500) return 'WARN';
    return 'CRITICAL';
  }
  
  getRecent(limit = 50) {
    return this.errors.slice(-limit).reverse();
  }
}

module.exports = new ErrorTracker();
```

**3.2 Actualizar `backend/controllers/analyticsController.js`**

```javascript
// CAMBIO EN: controllers/analyticsController.js

const errorTracker = require('../services/errorTracker');

// Cambiar:
exports.getOccupancyTrend = ErrorHandlingService.asyncWrapper(async (req, res) => {
  // ... código

// A:
exports.getOccupancyTrend = async (req, res) => {
  try {
    const appMode = resolveAppMode(req);
    
    // ... lógica original
    
    res.json(occupancyData);
  } catch (error) {
    errorTracker.track(error, {
      endpoint: '/api/analytics/occupancy-trend',
      method: 'GET',
      mode: req.headers['x-app-mode']
    });
    
    res.status(500).json({
      error: 'Failed to fetch occupancy trend',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
```

**3.3 Crear helper middleware en `backend/middlewares/errorWrapper.js`**

```javascript
// NEW FILE: backend/middlewares/errorWrapper.js
const errorTracker = require('../services/errorTracker');

function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      errorTracker.track(error, {
        endpoint: req.path,
        method: req.method,
        mode: req.headers['x-app-mode']
      });
      
      res.status(error.statusCode || 500).json({
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    });
  };
}

module.exports = asyncErrorHandler;
```

**3.4 Test en `backend/tests/unit/errorHandling.test.js`**

```javascript
// NEW FILE: backend/tests/unit/errorHandling.test.js
const errorTracker = require('../../services/errorTracker');

describe('Error Handling', () => {
  it('should track errors with context', () => {
    const error = new Error('Test error');
    const context = {
      endpoint: '/test',
      method: 'GET'
    };
    
    errorTracker.track(error, context);
    
    const recent = errorTracker.getRecent(1);
    expect(recent[0].message).toBe('Test error');
    expect(recent[0].context).toEqual(context);
  });
  
  it('should track error severity', () => {
    const error = new Error('Server error');
    error.statusCode = 500;
    
    errorTracker.track(error, {});
    
    const recent = errorTracker.getRecent(1);
    expect(recent[0].severity).toBe('CRITICAL');
  });
});
```

---

## PASO 4: Auditoría Completa (Día 7, 3 días)

### Objetivo
- Todas las operaciones críticas auditadas
- Diff-tracking para cambios
- User context en audits

### Identificar operaciones críticas

```
✅ YA AUDITADAS:
   └─ createReservation
   └─ deleteReservation

❌ NECESARIAS:
   └─ updateReservation (con diff)
   └─ assignRoom
   └─ processPayment
   └─ changeRoomStatus
   └─ completeMaintenance
   └─ markRoomAsClean
   └─ createUser
   └─ updateUser
   └─ deleteUser
```

### Implementación

**4.1 Crear `backend/services/auditService.js`**

```javascript
// NEW FILE: backend/services/auditService.js
const AuditLog = require('../models/AuditLog');
const { resolveAppMode } = require('./appModeService');

class AuditService {
  async log(req, {
    entity,        // 'Reservation', 'Room', 'User'
    entityId,      // _id del documento
    action,        // 'CREATE', 'UPDATE', 'DELETE'
    before,        // Estado anterior (para UPDATE)
    after,         // Estado nuevo
    changes        // Qué campos cambiaron
  }) {
    try {
      const auditEntry = new AuditLog({
        userId: req.user?._id,
        userEmail: req.user?.email,
        entity,
        entityId,
        action,
        before,
        after,
        changes: changes || this.detectChanges(before, after),
        mode: resolveAppMode(req),
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      await auditEntry.save();
      return auditEntry;
    } catch (error) {
      console.error('[AUDIT] Error saving audit log:', error);
      // No bloquear la operación principal por error de auditoría
      return null;
    }
  }
  
  detectChanges(before, after) {
    if (!before || !after) return [];
    
    const changes = [];
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {})
    ]);
    
    for (const key of allKeys) {
      const beforeVal = before[key];
      const afterVal = after[key];
      
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes.push({
          field: key,
          before: beforeVal,
          after: afterVal
        });
      }
    }
    
    return changes;
  }
}

module.exports = new AuditService();
```

**4.2 Actualizar `backend/controllers/reservationController.js`**

```javascript
// CAMBIO EN: controllers/reservationController.js

const auditService = require('../services/auditService');

// En updateReservation():
exports.updateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const before = await Reservation.findById(id).lean();
    
    const updated = await Reservation.findByIdAndUpdate(id, req.body, { new: true });
    
    // NUEVO: Registrar auditoría con cambios
    await auditService.log(req, {
      entity: 'Reservation',
      entityId: id,
      action: 'UPDATE',
      before,
      after: updated.toObject()
    });
    
    res.json(updated);
  } catch (error) {
    // ... error handling
  }
};

// En assignRoom():
exports.assignRoom = async (req, res) => {
  try {
    const { reservationId, roomId } = req.body;
    const before = await Reservation.findById(reservationId).lean();
    
    const updated = await Reservation.findByIdAndUpdate(
      reservationId,
      { room: roomId },
      { new: true }
    );
    
    // NUEVO: Auditoría
    await auditService.log(req, {
      entity: 'Reservation',
      entityId: reservationId,
      action: 'UPDATE',
      before,
      after: updated.toObject()
    });
    
    res.json(updated);
  } catch (error) {
    // ...
  }
};
```

**4.3 Actualizar `backend/controllers/billingController.js`**

```javascript
// CAMBIO EN: controllers/billingController.js

const auditService = require('../services/auditService');

// En processPayment():
exports.processPayment = async (req, res) => {
  try {
    const { reservationId, amount } = req.body;
    
    const before = await Reservation.findById(reservationId).lean();
    
    // ... lógica de pago
    
    const updated = await Reservation.findById(reservationId);
    
    // NUEVO: Auditoría de pago crítico
    await auditService.log(req, {
      entity: 'Payment',
      entityId: reservationId,
      action: 'PROCESS_PAYMENT',
      before: { payment: before.payment },
      after: { payment: updated.payment },
      changes: [{ field: 'amount', value: amount }]
    });
    
    res.json(updated);
  } catch (error) {
    // ...
  }
};
```

**4.4 Test en `backend/tests/unit/auditService.test.js`**

```javascript
// NEW FILE: backend/tests/unit/auditService.test.js
const auditService = require('../../services/auditService');

describe('Audit Service', () => {
  it('should detect field changes', () => {
    const before = { name: 'Old', value: 100 };
    const after = { name: 'New', value: 100 };
    
    const changes = auditService.detectChanges(before, after);
    
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('name');
  });
  
  it('should log with context', async () => {
    const req = {
      user: { _id: 'user123', email: 'test@example.com' },
      headers: { 'x-app-mode': 'demo' },
      ip: '127.0.0.1',
      get: () => 'Mozilla/5.0'
    };
    
    const result = await auditService.log(req, {
      entity: 'Test',
      entityId: 'test123',
      action: 'TEST',
      before: {},
      after: {}
    });
    
    expect(result).toBeTruthy();
  });
});
```

---

## PASO 5: Logging Centralizado (Día 10, 2 días)

### Objetivo
- Todos los logs con requestId (tracing)
- Centralizado en Winston
- Timestamps consistentes

### Implementación

**5.1 Crear `backend/middlewares/requestLoggingMiddleware.js`**

```javascript
// NEW FILE: backend/middlewares/requestLoggingMiddleware.js
const { v4: uuidv4 } = require('uuid');
const { logHelpers } = require('../config/logger');

function requestLoggingMiddleware(req, res, next) {
  // Asignar requestId único
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  
  // Meter requestId en contexto global de logs
  req.log = {
    info: (msg, data) => logHelpers.info(msg, { ...data, requestId: req.requestId }),
    warn: (msg, data) => logHelpers.warn(msg, { ...data, requestId: req.requestId }),
    error: (msg, error) => logHelpers.error(msg, error, { requestId: req.requestId })
  };
  
  // Log de entrada
  req.log.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    mode: req.headers['x-app-mode'],
    userId: req.user?._id
  });
  
  // Log de salida
  const originalSend = res.send;
  res.send = function(data) {
    req.log.info(`${req.method} ${req.path} - ${res.statusCode}`, {
      duration_ms: Date.now() - req.startTime,
      status: res.statusCode
    });
    
    return originalSend.call(this, data);
  };
  
  req.startTime = Date.now();
  next();
}

module.exports = requestLoggingMiddleware;
```

**5.2 Integrar en `backend/app.js`**

```javascript
// CAMBIO EN: app.js

const requestLoggingMiddleware = require('./middlewares/requestLoggingMiddleware');

// Agregar muy temprano:
app.use(requestLoggingMiddleware);

// Todos los logs ahora tendrán requestId
```

**5.3 Test en `backend/tests/unit/requestLogging.test.js`**

```javascript
// NEW FILE: backend/tests/unit/requestLogging.test.js
const express = require('express');
const requestLogging = require('../../middlewares/requestLoggingMiddleware');

describe('Request Logging Middleware', () => {
  it('should add requestId to request', () => {
    const app = express();
    app.use(requestLogging);
    app.get('/test', (req, res) => {
      expect(req.requestId).toBeTruthy();
      res.json({ id: req.requestId });
    });
    
    // Mock test
    const req = { 
      headers: {},
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
      get: () => 'Mozilla'
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn()
    };
    
    requestLogging(req, res, () => {
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
    });
  });
  
  it('should track request duration', (done) => {
    const req = {
      headers: {},
      method: 'GET',
      path: '/test',
      startTime: Date.now(),
      ip: '127.0.0.1',
      get: () => 'Mozilla'
    };
    const res = {
      setHeader: jest.fn(),
      statusCode: 200,
      send: jest.fn()
    };
    
    requestLogging(req, res, () => {
      expect(req.startTime).toBeTruthy();
      done();
    });
  });
});
```

---

## PASO 6: Índices MongoDB (Día 12, 1 día)

### Objetivo
- Auditar índices existentes
- Agregar 2-3 índices faltantes
- Verificar performance

### Implementación

**6.1 Verificar índices en `backend/models/User.js`**

```javascript
// CAMBIO EN: models/User.js

const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  // ... otros campos
});

// AGREGAR ÍNDICE:
userSchema.index({ email: 1 }); // Mejorar búsquedas por email

module.exports = mongoose.model('User', userSchema);
```

**6.2 Verificar índices en `backend/models/Client.js`**

```javascript
// CAMBIO EN: models/Client.js

const clientSchema = new Schema({
  dni: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  // ...
});

// AGREGAR ÍNDICES:
clientSchema.index({ dni: 1 });   // Búsquedas por DNI
clientSchema.index({ email: 1 }); // Búsquedas por email

module.exports = mongoose.model('Client', clientSchema);
```

**6.3 Script de auditoría en `backend/scripts/auditIndexes.js`**

```javascript
// NEW FILE: backend/scripts/auditIndexes.js
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const Client = require('../models/Client');
const AuditLog = require('../models/AuditLog');

async function auditIndexes() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const models = [
    { name: 'Room', model: Room },
    { name: 'Reservation', model: Reservation },
    { name: 'User', model: User },
    { name: 'Client', model: Client },
    { name: 'AuditLog', model: AuditLog }
  ];
  
  console.log('\n📊 MONGODB INDEXES AUDIT\n');
  
  for (const { name, model } of models) {
    const indexes = await model.collection.getIndexes();
    console.log(`${name}:`);
    for (const [indexName, spec] of Object.entries(indexes)) {
      console.log(`  ├─ ${indexName}:`, spec);
    }
    console.log();
  }
  
  await mongoose.connection.close();
}

auditIndexes().catch(console.error);
```

**6.4 Ejecutar auditoría**

```bash
cd backend
npm run audit:indexes

# Output:
# 📊 MONGODB INDEXES AUDIT
# 
# Room:
#   ├─ _id_: { v: 2 }
#   ├─ status_1: { ... }
#   ├─ mode_1_number_1: { unique: true }
# 
# Reservation:
#   ├─ _id_: { v: 2 }
#   ├─ mode_1_checkIn_1_checkOut_1: { ... }
# ...
```

---

## Resumen Ejecución

### Checklist por Día

```
Día 1-2:  ✅ PASO 1 - Health Endpoint
          └─ 2 horas: código
          └─ 2 horas: tests + integration
          └─ Validation: npm test + curl

Día 3-4:  ✅ PASO 2 - Memory Leaks
          └─ 4 horas: gracefulShutdown
          └─ 2 horas: refactor listeners
          └─ Validation: npm test (clean shutdown)

Día 5-6:  ✅ PASO 3 - Error Handling
          └─ 4 horas: errorTracker
          └─ 4 horas: refactor controllers
          └─ Validation: error scenarios test

Día 7-9:  ✅ PASO 4 - Auditoría
          └─ 4 horas: auditService
          └─ 6 horas: integrate en 10 controllers
          └─ Validation: audit logs check

Día 10-11: ✅ PASO 5 - Logging
          └─ 3 horas: requestLogging middleware
          └─ 2 horas: integración
          └─ Validation: requestId en todos logs

Día 12:   ✅ PASO 6 - Índices
          └─ 1 hora: auditar + agregar
          └─ 1 hora: verification
```

**Total:** 12 días (~2 sprints de 5-6 días)

---

## PRÓXIMOS PASOS (Después de los 6 PASOS)

### Sprint 2: Test Coverage (8 días)

```
Priority 1 (5-6 tests c/u):
├─ analyticsController        [2 days]
├─ maintenanceController      [2 days]
└─ reportController           [2 days]

Priority 2 (3-4 tests c/u):
├─ systemController           [1 day]
├─ userController             [1 day]
└─ Error scenarios            [2 days]

Total: 8 días → +3-4% coverage
Target: 30-35% global
```

### Sprint 3: Stress & Validation (5 días)

```
├─ Stress testing (100 concurrent users)
├─ Memory profile (24h run)
├─ Performance benchmarks
├─ Error injection tests
└─ Final security audit
```

---

## Success Criteria Finales

✅ **Ready for Production cuando:**
- [ ] All 6 PASOS implementados + tested
- [ ] 0 memory leaks (Jest clean shutdown)
- [ ] 0 unhandled errors (all controllers try-catch)
- [ ] 100% critical operations audited
- [ ] All logs with requestId + timestamps
- [ ] Health endpoint operational
- [ ] MongoDB índices optimized
- [ ] Stress test passed (1000+ RPS)
- [ ] 24h staging run completed
- [ ] Prod deployment guide written

---

**Documento:** 2026-06-16 18:00 UTC  
**Status:** Plan detallado listo para ejecución  
**Next:** Comenzar PASO 1 mañana
