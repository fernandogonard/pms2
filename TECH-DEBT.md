# TECH-DEBT.md — Registro de Deuda Técnica (PMS2)

**Última actualización:** 2026-06-16  
**Próxima revisión:** Semanalmente en Sprint Planning  
**Responsable:** Tech Lead

---

## 📋 Matriz de Deuda Técnica

### 🔴 CRÍTICO (Bloquea Producción)

| ID | Item | Sprint | Estimación | Bloqueador | Status |
|----|------|--------|-----------|-----------|--------|
| **TD-C001** | Conflict Detector para double-booking | Sprint 0 | 5d | ✅ Sí | ⏳ NOT STARTED |
| **TD-C002** | Overbooking Guard (cantidad limit) | Sprint 0 | 3d | ✅ Sí | ⏳ NOT STARTED |
| **TD-C003** | WebSocket message ordering guarantee | Sprint 0 | 4d | ⚠️ High risk | ⏳ NOT STARTED |
| **TD-C004** | Event Matrix completamente mapeada | Sprint 0 | 3d | ✅ Sí | ⏳ NOT STARTED |
| **TD-C005** | Audit trail completo (housekeeping) | Sprint 1 | 4d | ⚠️ Compliance | ⏳ NOT STARTED |

### 🟡 ALTO (Debe hacerse antes de producción)

| ID | Item | Sprint | Estimación | Impacto | Status |
|----|------|--------|-----------|---------|--------|
| **TD-H001** | Stress test (100+ concurrent users) | Sprint 0 | 2d | Performance | ⏳ NOT STARTED |
| **TD-H002** | Health endpoint (/api/system/health) | Sprint 0 | 1d | Monitoring | ⏳ NOT STARTED |
| **TD-H003** | MongoDB indexes audit | Sprint 0 | 1.5d | Performance | ⏳ NOT STARTED |
| **TD-H004** | Rate limiting implementation | Sprint 1 | 2d | Security | ⏳ NOT STARTED |
| **TD-H005** | Error tracking (Sentry integration) | Sprint 1 | 1.5d | Observability | ⏳ NOT STARTED |
| **TD-H006** | Payment refund flow | Sprint 1 | 3d | Feature | ⏳ NOT STARTED |

### 🟢 BAJO (Técnico, no bloquea)

| ID | Item | Sprint | Estimación | Deuda | Status |
|----|------|--------|-----------|-------|--------|
| **TD-L001** | Remove AvailabilityService.js (dead) | Sprint +1 | 1d | Legacy | ⏳ NOT STARTED |
| **TD-L002** | Remove RoomCalendar model (unused) | Sprint +1 | 1d | Legacy | ⏳ NOT STARTED |
| **TD-L003** | Jest open handles cleanup | Sprint +1 | 0.5d | CI/CD | ⏳ NOT STARTED |
| **TD-L004** | ESLint rule: detect queries without mode | Sprint +1 | 1d | Prevention | ⏳ NOT STARTED |
| **TD-L005** | Remove calculateRoomStates import | Sprint +1 | 0.5d | Cleanup | ✅ DONE (PASO 5) |
| **TD-L006** | Update API documentation | Sprint +1 | 1d | Docs | ⏳ NOT STARTED |

---

## 📊 Deuda por Categoría

### Arquitectónica (7 items)
```
├─ [CRÍTICO] Conflict Detector          5d → Previene double-booking
├─ [CRÍTICO] Overbooking Guard          3d → Previene overselling
├─ [CRÍTICO] Event Matrix               3d → Integridad de eventos
├─ [ALTO]    WebSocket ordering         4d → Consistency
├─ [ALTO]    Audit trail                4d → Compliance
├─ [BAJO]    Legacy code removal        2d → Mantenibilidad
└─ [BAJO]    ESLint prevention          1d → Automatización
```
**Total:** ~22 días de trabajo

### Operacional (6 items)
```
├─ [CRÍTICO] Health endpoint            1d → Monitoreo
├─ [ALTO]    Stress testing             2d → Performance
├─ [ALTO]    Mongo indexes              1.5d → Query speed
├─ [ALTO]    Rate limiting              2d → Security
├─ [ALTO]    Error tracking             1.5d → Debugging
├─ [BAJO]    Jest open handles          0.5d → CI cleanliness
└─ [BAJO]    API docs                   1d → Developer experience
```
**Total:** ~9.5 días

### Funcional (1 item)
```
└─ [ALTO]    Payment refund flow        3d → Feature completeness
```

---

## 📈 Burn Down Graph (Ideado)

```
Deuda total: 34.5 días de trabajo

Sprint 0 (Pre-producción):
├─ Semana 1 (Jun 16-20):
│  ├─ Conflict Detector             5d ✅
│  ├─ Health endpoint              1d ✅
│  └─ Stress test setup            2d ✅
│  └─ → Deuda restante: 25.5d
│
├─ Semana 2 (Jun 23-27):
│  ├─ Overbooking Guard            3d ✅
│  ├─ Event Matrix mapping         3d ✅
│  ├─ WebSocket ordering           4d ✅
│  └─ → Deuda restante: 15.5d
│
└─ Semana 3 (Jun 30-Jul 4):
   ├─ Auditar Mongo indexes        1.5d ✅
   ├─ Audit trail housekeeping     4d ✅ (partial)
   └─ → Deuda restante: 10d

POST-PRODUCCIÓN:

Sprint +1:
├─ Payment refund flow            3d ✅
├─ Rate limiting                  2d ✅
├─ Error tracking                 1.5d ✅
├─ Legacy code removal            2d ✅
├─ ESLint prevention rule         1d ✅
├─ Jest cleanup                   0.5d ✅
└─ API documentation             1d ✅
└─ → Final deuda: 0d
```

---

## 🎯 Dependencias Entre Items

```
TD-C001 (Conflict Detector)
  ↓ depends on
TD-002 (Event Matrix mapping)
  
TD-C002 (Overbooking Guard)
  ↓ depends on
TD-C001 + TD-H002 (Health endpoint para testing)

TD-H001 (Stress test)
  ↓ depends on
TD-C001 + TD-C002 + TD-H003 (Indexes)

TD-H004 (Rate limiting)
  ↓ no dependencies
  
TD-L004 (ESLint rule)
  ↓ depends on
TD-C005 (Audit trail, pattern known)
```

---

## 📝 Cómo Reportar Deuda Nueva

**Formato:**

```
---
ID: TD-[C|H|L]NNN
Title: [Descripción breve]
Category: [Arquitectónica|Operacional|Funcional]
Severity: [CRÍTICO|ALTO|BAJO]
Estimación: Xd (días)
Descubierto: [Fecha]
Bloqueador: [Sí/No]
---

Problema: [Qué es el problema]

Impacto: [Cómo afecta al sistema]

Solución propuesta: [Cómo arreglarlo]

Precedencia: [Depende de]
```

---

## 📊 Métricas de Deuda Técnica

### Actual

```
Deuda Total:          34.5 días
├─ Bloqueadores:      16d (47%)  ← Pre-producción
├─ High Priority:     12.5d (36%) ← Sprint +1
└─ Low Priority:      6d (17%)   ← Sprint +2

Deuda por semana:
├─ Semana 1 (pre):   10.5d resuelto
├─ Semana 2 (pre):   10.5d resuelto
├─ Semana 3 (pre):   7.5d resuelto
└─ Sprint +1:        11.5d resuelto
└─ Total: 40d (estimado con ajustes)
```

### Proyección

```
IF no se toca deuda:
  → Complejidad sube 15% cada sprint
  → Velocidad baja 10% cada sprint
  → A Sprint +4: apenas avanza

IF se sigue plan de deuda:
  → Sprint +2: sistema operativamente maduro
  → Sprint +3: pronto para escala (100+ hotels)
```

---

## ✅ Deuda Resuelta (En esta sesión)

- ✅ **TD-L005:** Removidos calculateRoomStates imports (PASO 5)
- ✅ **TD-002:** Mode segmentation normalizado (PASO 5)
- ✅ **Documentación:** ADR files creados (PASO 7)

---

## 📅 Próxima Revisión

**Sprint Planning:** Cada viernes 10:00 AM  
**Owner:** Tech Lead + Arquitecto  
**Duración:** 30 min

---

## 🔗 Referencias

- [HEALTH-CHECK.md](HEALTH-CHECK.md) — Estado del sistema en tiempo real
- [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md) — Checklist pre-prod
- [docs/adr/](adr/) — Architecture Decision Records
