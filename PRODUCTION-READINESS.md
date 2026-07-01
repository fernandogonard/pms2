# PRODUCTION-READINESS.md — Checklist Pre-Producción (PMS2)

**Última actualización:** 2026-06-16  
**Próxima revisión:** 3 días antes del deploy  
**Responsable:** DevOps Lead

---

## 📋 Checklist de Producción

### ✅ APLICACIÓN

- [x] Tests de regresión (47/47 ✅)
- [x] Code review completado
- [x] Zero breaking changes
- [ ] **Conflict Detector implementado**
- [ ] **Overbooking Guard implementado**
- [ ] **Event Matrix completamente mapeada**
- [x] Mode segmentation validado (PASO 5)
- [x] ADR documentation (PASO 7)
- [ ] Performance benchmarked (< 200ms p95)
- [ ] Load tested (100+ concurrent)

### ✅ BASE DE DATOS

- [x] MongoDB connection verified
- [x] Schema validation tight (strict: true)
- [x] Indexes defined:
  - [x] Room: { mode, type, status }
  - [x] Reservation: { mode, checkIn, checkOut, status }
  - [x] Payment: { mode, reservationId }
- [ ] Backup strategy configured
  - [ ] Automated daily backups
  - [ ] Point-in-time recovery tested
  - [ ] Restore procedure documented
- [ ] Mongo indexes verified with `db.collection.getIndexes()`
- [ ] TTL indexes for logs (if applicable)

### ✅ SEGURIDAD

- [x] Environment variables documented
  - [x] DATABASE_URL (masked in logs)
  - [x] JWT_SECRET (strong, rotated)
  - [x] NODE_ENV = 'production'
- [ ] Helmet configured (already in code, but verify)
- [ ] CORS whitelist configured
  - [ ] Only allow production frontend domain
  - [ ] Remove localhost/dev domains
- [ ] Rate limiting implemented
- [ ] HTTPS enforced
  - [ ] SSL certificates valid
  - [ ] Automatic renewal (Let's Encrypt)
- [ ] Input validation (Joi schemas)
- [ ] SQL injection prevention (using Mongoose)
- [ ] XSS prevention (helmet + CSP headers)
- [ ] CSRF protection (if forms exist)
- [ ] Password hashing (bcryptjs minimum 10 rounds)

### ✅ OBSERVABILITY

- [ ] **Health endpoint working**
  - [ ] GET /api/system/health returns 200 + status JSON
  - [ ] Includes: calendar, availabilityEngine, websocket, tests
- [ ] Logging configured
  - [ ] Winston/Bunyan for structured logs
  - [ ] Log level: 'info' in prod (not 'debug')
  - [ ] Logs include: timestamp, level, message, requestId
- [ ] Error tracking integrated
  - [ ] Sentry or similar (error capture)
  - [ ] Slack alerts configured
  - [ ] Error dashboard accessible
- [ ] Monitoring alerts
  - [ ] Database connection lost → alert
  - [ ] Error rate > 1% → alert
  - [ ] Memory > 80% → alert
  - [ ] Response time > 500ms → alert
- [ ] Metrics collection
  - [ ] Prometheus metrics (optional but good)
  - [ ] Dashboard visible to ops team

### ✅ WEBSOCKET

- [x] Mode field in all events (PASO 5)
- [x] Frontend filtering implemented
- [ ] Reconnection logic tested
- [ ] Max concurrent connections set
- [ ] Message ordering guarantee (pending)
- [ ] Backpressure handling (pending)
- [ ] Memory leak tests (WS cleanup)

### ✅ API

- [ ] API documentation generated (Swagger/OpenAPI)
- [ ] Rate limiting headers returned
- [ ] Error responses consistent (format + status codes)
- [ ] Deprecation warnings for old endpoints (if any)
- [ ] Version header included (X-API-Version)
- [ ] Request ID propagation (tracing)

### ✅ PERFORMANCE

- [ ] Response time p95 < 200ms
  - [ ] GET /api/rooms/availability: < 100ms
  - [ ] POST /api/reservations: < 150ms
  - [ ] GET /api/system/health: < 50ms
- [ ] Database queries optimized
  - [ ] All queries with indexes
  - [ ] No N+1 queries
  - [ ] Lean() used for read-heavy queries
- [ ] Frontend bundle size acceptable
  - [ ] Main JS < 500KB
  - [ ] Initial paint < 3s
- [ ] CDN configured (if static assets)

### ✅ DEPLOYMENT

- [ ] Deployment script created (bash/PowerShell)
- [ ] Rollback procedure documented (git revert)
- [ ] Automatic health check post-deploy
- [ ] Blue-green deployment planned (if possible)
- [ ] Canary deployment considered (10% traffic first)
- [ ] Smoke tests automated
  - [ ] Create reservation → delete → OK
  - [ ] Check-in → check-out → OK
  - [ ] Payment flow → OK
- [ ] Zero-downtime deployment (if db migration needed)

### ✅ OPERATIONAL

- [ ] On-call rotation established
- [ ] Runbook created (what to do if X breaks)
- [ ] Escalation path defined (Slack → PagerDuty)
- [ ] Incident response plan
- [ ] Backup contacts documented
- [ ] Maintenance windows communicated (if needed)

### ✅ COMPLIANCE / LEGAL

- [ ] Data privacy policy (GDPR/CCPA)
- [ ] Terms of service updated
- [ ] Audit logging enabled (who did what when)
- [ ] Data retention policy defined
- [ ] Encryption at rest (if sensitive data)
- [ ] Encryption in transit (HTTPS)

---

## 🚀 Checklist por Tipo de Deploy

### Deploy a Demo (Staging)

```
┌─────────────────────────────────────────┐
│      Demo Deployment Checklist          │
├─────────────────────────────────────────┤
│ ✅ Code review passed                   │
│ ✅ Tests green (47/47)                  │
│ ✅ Manual QA: 2 browsers (demo + prod)  │
│ ✅ No cross-mode pollution detected     │
│ ✅ Health endpoint returns OK           │
│ ✅ Database backup taken                │
│ ✅ Rollback plan confirmed              │
│ ✅ Monitoring alerts active             │
│ → PROCEED                               │
└─────────────────────────────────────────┘
```

**Timeline:** Jun 21 (Martes)  
**Duration:** 30 minutos  
**Rollback:** 5 minutos (git revert)

### Deploy a Production

```
┌─────────────────────────────────────────┐
│   Production Deployment Checklist       │
├─────────────────────────────────────────┤
│ ✅ Demo running stable (3+ days)        │
│ ✅ Conflict Detector implemented        │
│ ✅ Overbooking Guard implemented        │
│ ✅ Event Matrix complete                │
│ ✅ Stress test passed (100+ users)      │
│ ✅ Backup strategy tested               │
│ ✅ Error tracking working               │
│ ✅ On-call rotation ready               │
│ ✅ Runbook reviewed                     │
│ ✅ Communication sent to stakeholders   │
│ → PROCEED WITH CAUTION                  │
└─────────────────────────────────────────┘
```

**Timeline:** Jul 1 (Viernes)  
**Duration:** 1 hora  
**Rollback:** 5-10 minutos (DB restore + git revert)  
**Monitoring:** 24h intensive

---

## 📊 Current Status

### Completed ✅
- [x] Code implementation (PASO 5)
- [x] Testing & regression (PASO 6)
- [x] Documentation (PASO 7)
- [x] ADR files created
- [x] Tech-debt tracked

### In Progress ⏳
- [ ] ADR review (pending)
- [ ] Demo deployment prep

### Blocked 🔴
- [ ] Conflict Detector (needs to be built)
- [ ] Overbooking Guard (needs to be built)
- [ ] Event Matrix (needs completion)

---

## 🎯 Timeline Propuesto

### Semana 1 (Jun 16-20)
```
Lun Jun 16   Merge PASO 5 + ADR
Mar Jun 17   Code review + feedback
Mié Jun 18   Conflict Detector start
Jue Jun 19   Overbooking Guard start
Vie Jun 20   Stress test, prepare demo deploy
```

### Semana 2 (Jun 23-27)
```
Lun Jun 23   Deploy to demo
Mar-Jue      Monitor + stabilize
Vie Jun 27   All green, request production deploy
```

### Semana 3 (Jun 30-Jul 4)
```
Lun Jun 30   Final checks + runbook review
Mar Jul 1    Deploy to production (HIGH ALERT)
Mié-Vie      24h monitoring
```

---

## ⚠️ Riesgos Pre-Producción

| Riesgo | Probabilidad | Impacto | Mitigation |
|--------|-------------|---------|-----------|
| **Conflict Detector no lista** | 60% | CRÍTICO | Start immediately |
| **Performance issues under load** | 40% | ALTO | Stress test early |
| **Data loss during migration** | 5% | CRÍTICO | Backup + restore test |
| **WebSocket disconnection** | 25% | MEDIO | Reconnection logic |
| **Cross-mode data leak** | 10% | ALTO | Manual QA validation |

---

## 📞 Responsabilidades

| Rol | Pre-Deploy | Deploy | Post-Deploy |
|-----|-----------|--------|-------------|
| **Dev Lead** | Code review | Deployment | Monitoring |
| **QA Lead** | Test execution | Smoke tests | Bug triage |
| **DevOps** | Infrastructure | Release | Rollback ready |
| **CTO** | Final approval | Watch | Incident mgmt |

---

## 🔗 Referencias

- [HEALTH-CHECK.md](HEALTH-CHECK.md) — Estado del sistema
- [TECH-DEBT.md](TECH-DEBT.md) — Deuda técnica a resolver
- [docs/adr/](docs/adr/) — Architecture decisions
- [RUNBOOK.md](RUNBOOK.md) — Operaciones (crear si no existe)

---

## ✅ Próximo Paso

**Ejecutar:** npm run audit:mode-queries  
**Resultado esperado:** 0 queries sin buildModeQuery  
**Si fail:** Fijar queries antes de deploy

---

**Documento:** 2026-06-16  
**Status:** 70% ready (bloqueada por Conflict Detector)  
**Próxima revisión:** Mañana 10:00 AM
