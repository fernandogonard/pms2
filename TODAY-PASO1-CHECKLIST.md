# 🚀 TODAY'S TASKS: PASO 1 - Health Endpoint

**Objetivo Hoy:** Implementar y testear GET /api/system/health  
**Timeline:** 4-5 horas  
**Checkpoint:** Sistema responde con JSON en status + métricos

---

## ✅ Tasks Checklist

### 1️⃣ Create Health Controller (30 mins)

- [ ] Create file: `backend/controllers/healthController.js`
  ```bash
  touch backend/controllers/healthController.js
  ```

- [ ] Copy template from IMPLEMENTATION-PLAN-PASO1-6.md (section 1.1)

- [ ] Verify code compiles:
  ```bash
  cd backend
  node -c controllers/healthController.js
  ```

**Checkpoint:** File exists, no syntax errors

---

### 2️⃣ Wire Up Routes (20 mins)

- [ ] Edit `backend/app.js`

- [ ] Find section with other routes (e.g., near `app.post('/auth/login')`)

- [ ] Add before health check:
  ```javascript
  const healthController = require('./controllers/healthController');
  
  // Health endpoint (public, no auth)
  app.get('/api/system/health', healthController.health);
  
  // Middleware for tracking
  app.use(healthController.recordRequest);
  ```

- [ ] Test syntax:
  ```bash
  node -c app.js
  ```

**Checkpoint:** app.js compiles

---

### 3️⃣ Manual Test - Start Server (20 mins)

- [ ] Start backend in terminal:
  ```bash
  cd backend
  npm start
  ```

- [ ] In NEW terminal, test endpoint:
  ```bash
  curl http://localhost:3001/api/system/health
  ```

- [ ] Expected response (should be valid JSON):
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-06-16T...",
    "uptime_seconds": 5,
    "components": {
      "database": "OK",
      "websocket": "OK",
      "availability_engine": "OK"
    },
    "metrics": {
      "memory_mb": 245,
      "uptime_seconds": 5,
      "recent_reservations": 12,
      "available_rooms": 45,
      "error_rate_percent": 0,
      "total_requests": 3
    },
    "mode": "demo"
  }
  ```

- [ ] Test multiple calls (verify metrics increment):
  ```bash
  curl http://localhost:3001/api/system/health | jq .metrics.total_requests
  # First call: 1
  curl http://localhost:3001/api/system/health | jq .metrics.total_requests
  # Second call: 2
  ```

**Checkpoint:** Endpoint returns JSON, metrics increment

---

### 4️⃣ Unit Tests (60 mins)

- [ ] Create file: `backend/tests/unit/healthController.test.js`

- [ ] Copy template from IMPLEMENTATION-PLAN-PASO1-6.md (section 1.3)

- [ ] Run tests:
  ```bash
  npm test -- healthController.test.js
  ```

- [ ] Expect: All 3 tests pass
  ```
  PASS tests/unit/healthController.test.js
    Health Controller
      ✓ should return healthy status when DB is OK (12 ms)
      ✓ should include uptime and metrics (8 ms)
      ✓ should track request count (5 ms)
  
  Test Suites: 1 passed, 1 total
  Tests:       3 passed, 3 total
  ```

**Checkpoint:** 3/3 tests passing

---

### 5️⃣ Integration Test (30 mins)

- [ ] Create simple integration test: `backend/tests/integration/health.integration.test.js`

```javascript
// NEW FILE: backend/tests/integration/health.integration.test.js
const request = require('supertest');
const app = require('../../app');

describe('Health Endpoint Integration', () => {
  it('should return 200 with health status', async () => {
    const response = await request(app)
      .get('/api/system/health')
      .expect(200);
    
    expect(response.body.status).toMatch(/healthy|degraded|down/);
    expect(response.body.components).toBeDefined();
    expect(response.body.metrics).toBeDefined();
  });
  
  it('should include all required fields', async () => {
    const response = await request(app)
      .get('/api/system/health')
      .expect(200);
    
    const { status, timestamp, components, metrics } = response.body;
    
    expect(status).toBeTruthy();
    expect(timestamp).toBeTruthy();
    expect(components.database).toBeTruthy();
    expect(metrics.memory_mb).toBeGreaterThan(0);
    expect(metrics.uptime_seconds).toBeGreaterThan(0);
  });
});
```

- [ ] Run integration test:
  ```bash
  npm test -- health.integration.test.js
  ```

- [ ] Expect: 2/2 tests passing

**Checkpoint:** Integration test passes

---

### 6️⃣ Coverage Check (15 mins)

- [ ] Run full test suite with coverage:
  ```bash
  npm test -- --coverage --testPathPattern="health"
  ```

- [ ] Check coverage output:
  ```
  healthController.js       100.00% | 100.00% | 100.00%
  ```

**Checkpoint:** healthController at 100% coverage

---

### 7️⃣ Documentation (15 mins)

- [ ] Create `backend/docs/HEALTH-ENDPOINT.md`:

```markdown
# Health Endpoint

## Endpoint
GET /api/system/health

## Response
```json
{
  "status": "healthy|degraded|down",
  "timestamp": "ISO8601",
  "components": {
    "database": "OK|ERROR",
    "websocket": "OK|ERROR",
    "availability_engine": "OK|ERROR"
  },
  "metrics": {
    "memory_mb": number,
    "uptime_seconds": number,
    "recent_reservations": number,
    "available_rooms": number,
    "error_rate_percent": number,
    "total_requests": number
  }
}
```

## Status Codes
- 200: Healthy
- 503: Degraded or Down

## Usage
```bash
# Monitor in production
curl http://localhost:3001/api/system/health

# Parse with jq
curl http://localhost:3001/api/system/health | jq .status

# Use in load balancer (health check every 30s)
```
```

- [ ] Verify file created:
  ```bash
  cat backend/docs/HEALTH-ENDPOINT.md
  ```

**Checkpoint:** Documentation written

---

## 🎯 End-of-Day Validation

**MUST HAVE BY EOD:**
- [ ] ✅ healthController.js created
- [ ] ✅ Routes wired in app.js
- [ ] ✅ Endpoint returns JSON (manual test)
- [ ] ✅ 3 unit tests passing
- [ ] ✅ 2 integration tests passing
- [ ] ✅ 0 memory leaks (Jest clean)
- [ ] ✅ Documentation written
- [ ] ✅ All tests running: `npm test`

---

## 🐛 Troubleshooting

### "Cannot find module healthController"
**Solution:** Verify file path is exactly:
```bash
backend/controllers/healthController.js
```

### "resolve() requires X-App-Mode header"
**Solution:** Test with header:
```bash
curl -H "X-App-Mode: demo" http://localhost:3001/api/system/health
```

### "Jest did not exit gracefully"
**Solution:** Health controller has memory leak (check for setInterval)

### Health returns 503 "database ERROR"
**Solution:** MongoDB not running or connection string wrong:
```bash
# Check MongoDB
mongosh "mongodb://localhost:27017"
```

---

## 📋 Quick Reference

### File Locations
```
Controllers:        backend/controllers/healthController.js
Routes:             backend/app.js (add near line 250)
Unit Tests:         backend/tests/unit/healthController.test.js
Integration Tests:  backend/tests/integration/health.integration.test.js
Docs:               backend/docs/HEALTH-ENDPOINT.md
```

### Commands
```bash
# Start server
npm start

# Test endpoint
curl http://localhost:3001/api/system/health

# Run all tests
npm test

# Run specific test
npm test -- healthController.test.js

# Check syntax
node -c backend/controllers/healthController.js
```

### Expected Files After PASO 1
```
backend/
├─ controllers/
│  └─ healthController.js              ← NEW
├─ tests/
│  ├─ unit/
│  │  └─ healthController.test.js      ← NEW
│  └─ integration/
│     └─ health.integration.test.js    ← NEW
├─ docs/
│  └─ HEALTH-ENDPOINT.md               ← NEW
└─ app.js                               ← MODIFIED (routes added)
```

---

## ✨ Success Criteria

```
PASS if:
✅ npm test passes (all tests green)
✅ curl returns JSON with status + metrics
✅ Memory metrics show positive number
✅ No "open handles" warning from Jest
✅ Documentation complete
✅ All 5 tests passing (3 unit + 2 integration)

FAIL if:
❌ Tests fail
❌ curl returns error/500
❌ JSON missing fields
❌ "open handles" warnings
❌ No documentation
```

---

**Target:** Complete by end of business (17:00)  
**Checkpoint:** Every 45 mins review progress  
**Escalation:** If blocked, check troubleshooting section

¡Adelante! 🚀
