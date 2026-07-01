# 🎯 FUNCIÓN CRÍTICA AUDIT — Clasificación por Impacto Real

**Objetivo:** Determinar qué de las 43 funciones sin tests son realmente críticas  
**Criterio:** ¿Perder datos? ¿Fallar operación? ¿Bloquear hotel?

---

## 🔴 TIER 1: CRÍTICO (Si falla → Hotel paralizado o datos perdidos)

| Función | Controller | Impacto | ¿Por qué? | Prioridad |
|---------|-----------|--------|----------|-----------|
| `createClient` | clientController | 🔴 CRÍTICO | Sin clientes NO HAY reservas | P0 |
| `createRoom` | roomController | 🔴 CRÍTICO | Sin habitaciones = hotel inoperable | P0 |
| `getAvailableRooms` | roomController | 🔴 CRÍTICO | Core business: ¿Hay cuarto disponible? | P0 |
| `setRoomStatus` | roomController | 🔴 CRÍTICO | Cambiar estado habitación (disponible/ocupada/mantenimiento) | P0 |
| `startMaintenance` | maintenanceController | 🔴 CRÍTICO | Sacar habitación de venta | P0 |
| `completeMaintenance` | maintenanceController | 🔴 CRÍTICO | Devolver habitación a servicio | P0 |
| `register` | authController | 🔴 CRÍTICO | Crear usuario (staff) | P0 |
| `login` | authController | 🔴 CRÍTICO | Acceso al sistema (SIN AUTH = vulnerable) | P0 |
| `changePassword` | authController | 🔴 CRÍTICO | Security crítica | P0 |

**Total Tier 1:** 9 funciones  
**Estado tests:** Parcialmente cubierto (auth tiene ~2, rooms/clients = 0)  
**Urgencia:** MÁXIMA (esta semana)

---

## 🟠 TIER 2: ALTO (Si falla → Datos inválidos o ingresos perdidos)

| Función | Controller | Impacto | ¿Por qué? | Prioridad |
|---------|-----------|--------|----------|-----------|
| `updateClient` | clientController | 🟠 ALTO | Cambiar datos cliente (nombre, email, etc) | P1 |
| `deleteClient` | clientController | 🟠 ALTO | Eliminar cliente (auditoría requerida) | P1 |
| `updateRoom` | roomController | 🟠 ALTO | Cambiar capacidad, tipo, precio | P1 |
| `deleteRoom` | roomController | 🟠 ALTO | Sacar habitación del catálogo | P1 |
| `getRoomsInCleaning` | roomController | 🟠 ALTO | Housekeeping workflow crítico | P1 |
| `markRoomAsClean` | roomController | 🟠 ALTO | Liberar cuarto para próximo guest | P1 |
| `markRoomsAsClean` | roomController | 🟠 ALTO | Batch operation de limpieza | P1 |
| `completeHousekeeping` | roomController | 🟠 ALTO | Finalizar housekeeping assignment | P1 |
| `getRoomsInMaintenance` | maintenanceController | 🟠 ALTO | Ver cuartos en mantenimiento | P1 |
| `checkMaintenanceImpact` | maintenanceController | 🟠 ALTO | Impacto de mantenimiento en disponibilidad | P1 |
| `createUser` | userController | 🟠 ALTO | Crear nuevo staff member | P1 |
| `updateUser` | userController | 🟠 ALTO | Cambiar rol/permisos de usuario | P1 |
| `deleteUser` | userController | 🟠 ALTO | Remover acceso de staff | P1 |

**Total Tier 2:** 13 funciones  
**Estado tests:** 0 (ninguna cubierta)  
**Urgencia:** ALTA (próximas 2 semanas)

---

## 🟡 TIER 3: MEDIO (Si falla → Reporting inválido, no datos perdidos)

| Función | Controller | Impacto | ¿Por qué? | Prioridad |
|---------|-----------|--------|----------|-----------|
| `getOccupancyTrend` | analyticsController | 🟡 MEDIO | Dashboard analytics (no afecta operación) | P2 |
| `getRevenueData` | analyticsController | 🟡 MEDIO | Revenue reporting (no datos perdidos) | P2 |
| `getRoomTypeDistribution` | analyticsController | 🟡 MEDIO | Stats (informativo) | P2 |
| `getCheckinTrend` | analyticsController | 🟡 MEDIO | Dashboard trend (informativo) | P2 |
| `getKPIs` | analyticsController | 🟡 MEDIO | KPI dashboard (informativo) | P2 |
| `occupancyReport` | reportController | 🟡 MEDIO | Report (informativo) | P2 |
| `getOccupancyReport` | reportController | 🟡 MEDIO | Report (informativo) | P2 |
| `getRevenueReport` | reportController | 🟡 MEDIO | Report (informativo) | P2 |
| `getCancellationReport` | reportController | 🟡 MEDIO | Report (informativo) | P2 |
| `revenueReport` | reportController | 🟡 MEDIO | Report (informativo) | P2 |
| `financialReport` | reportController | 🟡 MEDIO | Report (informativo) | P2 |
| `getReservationsOptimized` | reservationOptimized | 🟡 MEDIO | Listing (informativo) | P2 |
| `getReservationStats` | reservationOptimized | 🟡 MEDIO | Stats (informativo) | P2 |
| `getRoomStats` | statsController | 🟡 MEDIO | Stats (informativo) | P2 |

**Total Tier 3:** 14 funciones  
**Estado tests:** 0  
**Urgencia:** MEDIA (después de P0 y P1)  
**Nota:** Son reporting/analytics. Si fallan, gerente no ve reportes, pero hotel funciona.

---

## 🟢 TIER 4: BAJO (Helpers, utilidades, no críticas)

| Función | Controller | Impacto |
|---------|-----------|--------|
| `getRoomTypes` | roomController | Config endpoint |
| `getRoomsStatus` | roomController | Status snapshot |
| `getRooms` | roomController | List all |
| `getRoomById` | roomController | Get details |
| `getRoomAllowedStates` | roomController | Config |
| `updateRoomStates` | roomController | Internal cron |
| `updateRoomCalendar` | roomController | Legacy? |
| `debugRoomStatus` | roomController | Debug only |
| `getRoomStatus` | roomController | Status query |
| `listClients` | clientController | Listing |
| `getClient` | clientController | Get details |
| `lookupClient` | clientController | Search |
| `getUsers` | userController | List staff |
| `getUserById` | userController | Get details |
| `relocateGuest` | relocationController | Edge case |
| `getMaintenanceHistory` | maintenanceController | Reporting |
| `checkMaintenanceImpact` | maintenanceController | Analysis |
| `getRecommendedAction` | maintenanceController | Helper |
| `getCurrentUser` | authController | Get logged user |
| `logout` | authController | Clear session |

**Total Tier 4:** ~20 funciones  
**Estado tests:** 0  
**Urgencia:** BAJA (no bloquean producción)

---

## 📊 Resumen Clasificación

```
TIER 1 (CRÍTICO):  9 funciones     ← MÁXIMA URGENCIA
TIER 2 (ALTO):    13 funciones     ← ALTA URGENCIA
TIER 3 (MEDIO):   14 funciones     ← MEDIA URGENCIA
TIER 4 (BAJO):    ~20 funciones    ← BAJA URGENCIA
────────────────────────────────
TOTAL:            ~56 funciones
```

**La realidad:**
```
9 + 13 = 22 funciones CRÍTICAS para operación
        (Si estas fallan = hotel NO funciona)

14 = funciones para reporting
     (Si fallan = reports rotos pero hotel sigue)

~20 = helpers/UI/debug
      (Si fallan = UI degradada)
```

---

## 🎯 Implicación para Producción

**Pregunta clave:** ¿Podría funcionar 30 días sin perder datos?

**Respuesta actual:**  
```
SI, si los 22 functions TIER 1+2 funcionan bien
NO, si alguno de los TIER 1+2 falla
```

---

## ✅ Plan Realista (Según tu feedback)

### SEMANA 1: Las 5 Cosas Críticas

```
1. BACKUP + RESTORE         ← FALTABA (tu insight)
2. HEALTH ENDPOINT          ← Monitoring
3. MEMORY LEAKS FIX         ← Stability  
4. LOGGING + AUDITORÍA      ← Observability
5. ERROR HANDLING (T1+T2)   ← 22 funciones críticas
```

### RESULTADO
```
Hotel funciona 30 días sin perder datos ✅
Readiness: 45% → 65-70% ✅
```

---

**Status:** 🔴 CRÍTICO = Necesito Backup strategy ASAP

¿Procedo a crear `BACKUP-STRATEGY.md`?
