# ADR-003: Availability Engine como Única Fuente de Verdad

**Status:** Accepted (with caveats)  
**Decision Date:** 2026-06-16  
**Author:** GitHub Copilot (Audit PASO 1-3)  
**Related:** ADR-001, ADR-002

---

## Problema

**Pre-refactor:**
Coexistían 5 fuentes de verdad para disponibilidad de habitaciones:

1. **AvailabilityService.calculateRoomStates()** → Cálculo día completo
2. **roomStatusResolutionService** → Resolución por hora + prioridades
3. **Direct room.status field** → Estado persistido  
4. **RoomCalendar model** → Timeline de eventos (unused)
5. **Reservation queries** → Deducida de reservas overlapping

**Consecuencias:**
- Diferentes resultados por diferente algoritmo
- Imposible debuguear "por qué reserva rechazada"
- Frontend sincronizado con backend A, pero backend B calcula diferente
- Tests de disponibilidad frágiles por cambios de algoritmo

---

## Decisión Tomada

**AvailabilityEngine como orquestador único de resolución de estado**

### Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│              Cliente pide disponibilidad                │
│         GET /api/rooms/availability?checkIn=...        │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   roomController        │
          │  getAvailableRooms()    │
          └────────────┬────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │    AvailabilityEngine               │
    │                                     │
    │  1. Get all rooms (scoped by mode)  │
    │  2. Query overlapping reservations  │
    │  3. Calculate availability          │
    │     ├─ Via roomStatusResolutionSvc  │
    │     ├─ Priority: maintenance >      │
    │     │              limpieza >       │
    │     │              checkout >       │
    │     │              ocupada >        │
    │     │              disponible       │
    │     └─ Honra estado persistido      │
    │  4. Return filtered list            │
    │                                     │
    └──────────────────┬──────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Response to Client    │
          │   [{ id: 1, status:     │
          │      'available' }]     │
          └────────────────────────┘
```

### Flujo de Decisión

```
Para cada habitación:

┌─ ¿Está en mantenimiento?
│  YES → status = "mantenimiento"
│  NO → continua
│
├─ ¿Está marcada limpieza hoy?
│  YES → status = "limpieza"
│  NO → continua
│
├─ ¿Check-out hoy?
│  YES → status = "checkout"
│  NO → continua
│
├─ ¿Hay reserva active ahora?
│  YES → status = "ocupada"
│  NO → continua
│
└─ → status = "disponible"
```

### Reglas de Prioridad

```javascript
// roomStatusResolutionService.js

const PRIORITY_ORDER = {
  'mantenimiento': 1,  // Bloqueante
  'limpieza': 2,       // Operacional
  'checkout': 3,       // Temporal
  'ocupada': 4,        // Ocupada
  'disponible': 5      // Default
};

function resolveStatus(room, reservations, date) {
  const priority = calculatePriority(room, reservations, date);
  return getPriorityStatus(priority);
}
```

---

## Implementación Actual

### Código Base

```
backend/services/availabilityEngine.js
├─ New (PASO 4): Orquestador central
├─ Dependencies:
│  ├─ roomStatusResolutionService (resolución hora)
│  ├─ Room model (persistent state)
│  └─ Reservation model (bookings)
└─ Exported: calcAvailability(rooms, dates, mode)

backend/services/roomStatusResolutionService.js
├─ Existing: Resolución por hora + prioridades
├─ Inputs: room, reservations, date
└─ Output: status + reason

backend/services/AvailabilityService.js
├─ Legacy: calculateRoomStates() (DEPRECATED)
├─ Status: Dead code, being replaced
└─ To remove: Sprint +1
```

### Controlador

```javascript
// roomController.getAvailableRooms()
async function getAvailableRooms(req, res) {
  const { type, checkIn, checkOut, cantidad } = req.query;
  const appMode = resolveAppMode(req);
  
  // ✅ Usar AvailabilityEngine
  const availableRooms = await AvailabilityEngine.calcAvailability({
    type,
    checkIn,
    checkOut,
    mode: appMode,
    cantidad
  });
  
  res.json({ success: true, rooms: availableRooms });
}
```

---

## Validación

### Test Coverage

```
✅ roomStatusResolutionService.test.js
   ├─ Test: maintenance blocks all
   ├─ Test: cleaning overrides booking
   ├─ Test: priority order correct
   └─ 3/3 passing

✅ checkout-cleaning.test.js  
   ├─ 30 tests covering:
   │  ├─ Check-in → occupado
   │  ├─ Check-out → cleaning
   │  ├─ Cleaning complete → disponible
   │  └─ Edge cases
   └─ 30/30 passing

✅ modeSegmentationControllers.test.js
   ├─ Test: getAvailableRooms respects mode
   └─ 1/1 passing

Total: 34/34 tests related to availability
```

### Pruebas Manuales

```
Escenario A: Día normal
  Room 101: Checkout 11:00 → Limpieza → Disponible 14:00
  ✅ Estado correcto por hora

Escenario B: Mantenimiento
  Room 202: Marcada mantenimiento
  ✅ No aparece en disponibilidad

Escenario C: Overlapping reservas (SIN Conflict Detector aún)
  Room 303: Reserva 2026-06-20..25 + Reserva 2026-06-23..27
  ⚠️ Ambas aceptadas (Conflict Detector pending)
```

---

## Consecuencias

### ✅ Positivas

1. **Única fuente de verdad:** Todos los queries usan AvailabilityEngine
2. **Debuggeable:** Si hay error, está en un único lugar
3. **Testeable:** Test del engine = confianza en todo el sistema
4. **Auditable:** Log de decisiones por habitación
5. **Escalable:** Agregar nuevos estados es cambio singular

### ⚠️ Negativas

1. **Aún no es 100% completo:**
   - ❌ Conflict Detector: Double booking can occur
   - ❌ Overbooking guard: No límite de cantidad
   - ❌ Partial state:** Algunos endpoints aún usan queries diretas

2. **Performance unknown:** 
   - Sin stress test a escala
   - Timeout posible en grandes datasets

3. **Legacy code still present:**
   - calculateRoomStates en AvailabilityService (dead)
   - RoomCalendar model (unused)

---

## Riesgos Residuales

| Riesgo | Severidad | Status | Mitigación |
|--------|-----------|--------|-----------|
| **Conflict Detector missing** | 🔴 CRÍTICO | ⏳ PENDING | Implementar antes producción |
| **Overbooking validation missing** | 🔴 CRÍTICO | ⏳ PENDING | Implementar antes producción |
| **Legacy dead code** | 🟢 BAJO | ✅ DOCUMENTED | Remove in Sprint +1 |
| **Performance untested** | 🟡 MEDIO | ⏳ PENDING | Stress test pre-prod |

---

## Alternativas Consideradas

### 1. Microservicio de Availability
**Pros:** Escala independiente, especializado  
**Cons:** Latencia RPC, complexity, eventual consistency

**Rechazada:** Overkill para hoteles medianos

### 2. Cache en Redis
**Pros:** Query speed  
**Cons:** Invalidación compleja, eventual inconsistency

**Rechazada:** Premature optimization

### 3. Event sourcing (historial completo)
**Pros:** Auditabilidad perfecta  
**Cons:** Storage huge, query complex, slow

**Rechazada:** Para MVP no justificado

---

## Próximos Pasos

### Inmediatos (Sprint 0)
- [ ] Implementar **Conflict Detector**
- [ ] Implementar **Overbooking Guard**
- [ ] Stress test con 1000+ rooms

### Mediano plazo (Sprint +1)
- [ ] Remove AvailabilityService.js (dead code)
- [ ] Remove RoomCalendar model (unused)
- [ ] Consolidate into single file si needed

### Largo plazo
- [ ] Distributed cache layer (Redis)
- [ ] Real-time occupancy updates via WebSocket
- [ ] Analytics on availability patterns

---

## Referencias

- [ADR-001: Virtualizacion](ADR-001-Virtualizacion.md)
- [ADR-002: Mode-Demo-Production](ADR-002-Mode-Demo-Production.md)
- [HEALTH-CHECK: Availability Status](../HEALTH-CHECK.md#calendar-engine)
- Code: `backend/services/availabilityEngine.js`
- Code: `backend/services/roomStatusResolutionService.js`
- Tests: `backend/tests/services/roomStatusResolutionService.test.js`
- Tests: `backend/tests/integration/checkout-cleaning.test.js` (30 tests)
