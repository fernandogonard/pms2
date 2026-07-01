# SPRINT HARDENING FINAL - PMS DIVA

## Objetivo
Cerrar riesgos operativos críticos antes del piloto real.

Duración: 5 días

Reglas:
- No nuevas funcionalidades
- No cambios visuales
- Solo estabilidad, trazabilidad, consistencia y validación

## Estado Inicial
- Día 1 iniciado y con evidencia parcial: [TRACEABILITY-REPORT.md](TRACEABILITY-REPORT.md)
- Correlación requestId -> AuditLog validada para 5 acciones ejecutadas
- Gap actual: caso room-change no ejecutado por falta de habitación alternativa en esa corrida

---

## Día 1 - Trazabilidad End-to-End

### Objetivo
Demostrar reconstrucción forense completa desde AuditLog.

### Tareas
- Login -> AuditLog
- Create reservation -> AuditLog
- Update reservation -> AuditLog
- Checkin -> AuditLog
- Room change -> AuditLog
- Checkout -> AuditLog

### Entregable
- [TRACEABILITY-REPORT.md](TRACEABILITY-REPORT.md)

### Criterio de aceptación
Para cada acción debe existir:
- requestId
- usuario
- timestamp
- entidad afectada
- acción registrada

Resultado objetivo: 100% correlación.

### Nota de ejecución
Para cerrar 6/6 acciones, correr escenario controlado con al menos 2 habitaciones elegibles para swap real.

---

## Día 2 - Event Matrix Core

### Objetivo
Eliminar múltiples fuentes de verdad para estado operativo.

### Tareas
Crear:
- eventMatrixService.js
- resolveRoomStatus()
- buildDayTimeline()

Implementar eventos núcleo:
- CHECKIN
- CHECKOUT
- CLEANING
- MAINTENANCE

### Entregable
- EVENT-MATRIX-CORE.md

### Criterio de aceptación
Dada secuencia CHECKIN -> CLEANING -> CHECKOUT, el estado resultante debe ser consistente y determinista.

### Definición de Done (DoD)
- Tests unitarios de matriz en verde
- Sin romper contratos actuales de API
- Sin cambios de UI

---

## Día 3 - Conflict Detector

### Objetivo
Bloquear inconsistencias de negocio antes de impactar operación.

### Tareas
Crear:
- detectConflicts()

Detectar:
- Overbooking
- Habitación bloqueada
- Mantenimiento con huésped
- Checkin antes de limpieza
- Reserva sobre reserva

### Entregable
- CONFLICT-DETECTOR-REPORT.md

### Criterio de aceptación
100% de conflictos simulados detectados.

### Definición de Done (DoD)
- Suite de casos nominales y borde
- Cobertura de conflictos críticos del negocio hotelero

---

## Día 4 - Stress Testing

### Objetivo
Validar escalabilidad operativa con carga creciente.

### Escenarios
- A: 40 habitaciones / 200 reservas
- B: 100 habitaciones / 1000 reservas
- C: 300 habitaciones / 5000 reservas

### Medir
- CPU
- RAM
- Latencia API
- Tiempo de resolución Availability Engine
- Tiempo de render RoomCalendar

### Entregable
- STRESS-TEST-REPORT.md

### Criterio de aceptación
- P95 < 500 ms en operaciones críticas
- Sin errores críticos

### Definición de Done (DoD)
- Reproducibilidad del benchmark
- Evidencia de métricas por escenario

---

## Día 5 - Simulación Operativa Real

### Objetivo
Operar PMS como flujo hotelero completo.

### Flujo
- Crear huésped
- Crear reserva
- Checkin
- Cambio de habitación
- Consumos
- Checkout
- Facturación

### Validar
- Auditoría
- Estados
- Calendario
- Disponibilidad
- Backups

### Entregable
- PILOT-READINESS-REPORT.md

### Criterio de aceptación
- 0 pérdida de datos
- 0 inconsistencia crítica
- 0 error bloqueante

---

## Resultado Esperado del Sprint
- AuditLog validado
- RequestId validado
- Event Matrix operativa
- Conflict Detector operativo
- Stress Test ejecutado
- Piloto validado

Readiness estimado:
65-70% -> 85-90%

Apto para piloto controlado en hotel pequeño/mediano.

---

## Riesgos y Mitigaciones

### Riesgo 1
No ejecutar room-change por disponibilidad real.

Mitigación:
Preparar dataset mínimo con 2 habitaciones elegibles para misma ventana.

### Riesgo 2
Inconsistencias de actor en audit (userEmail sistema vs actor autenticado).

Mitigación:
Registrar evidencia y corregir en hardening, sin cambiar funcionalidad de negocio.

### Riesgo 3
Resultados de stress no representativos.

Mitigación:
Fijar scripts, volúmenes y métricas comparables por escenario.
