# PILOT READINESS REPORT

## Scope
Sprint Hardening Final (backend only):
- sin nuevas funcionalidades
- sin frontend
- sin RoomCalendar
- sin WebSockets
- sin Event Matrix

## Evidencia usada
- Trazabilidad 6/6: `backend/TRACEABILITY-6OF6-RAW.json`
- Disaster recovery: `DISASTER-RECOVERY-REPORT.md`
- Conflict detector: `CONFLICT-DETECTOR-REPORT.md`
- Stress test: `STRESS-TEST-REPORT.md`

## Riesgos cerrados
1. Trazabilidad 6/6 cerrada
   - login auditado con requestId
   - create reservation auditado con requestId
   - update reservation auditado con requestId
   - room change auditado con requestId
   - checkout auditado con requestId
   - backup auditado con requestId

2. Disaster recovery validado
   - backup manual
   - borrado directo en Mongo
   - restore exitoso
   - reserva restaurada verificada

3. Conflict Detector backend operativo
   - detecta 5/5 tipos requeridos

## Riesgos abiertos
1. Estabilidad bajo carga (crítico)
   - En stress test hubo respuestas 401/500 en endpoints bajo concurrencia.
   - No está cerrada todavía la causa raíz de esos errores.

2. Fidelidad de actor en auditoría (medio)
   - algunos eventos guardan `userEmail: sistema` en vez de usuario autenticado.
   - no rompe trazabilidad por requestId, pero reduce calidad forense.

## Métricas clave
- Trazabilidad 6/6: 100% correlación requerida cumplida
- Conflict Detector: 5/5 categorías detectadas
- Stress test:
  - 500 habitaciones
  - 1000 reservas
  - 50 concurrentes
  - p95 health: 175.18 ms
  - p95 availability: 92.05 ms
  - p95 reservationsList: 422.39 ms
  - throughput: 674.5 req/s
  - error rate: elevado por 401/500 bajo carga

## Decisión
NO GO para piloto en este estado.

Justificación:
- Aunque trazabilidad y detección de conflictos están en buen nivel, la tasa de errores bajo carga impide considerar el sistema estable para operación real.

## Condiciones para pasar a GO
1. Reducir errores HTTP bajo stress (objetivo: 0 errores críticos 5xx y 0 errores inesperados de auth en escenario controlado).
2. Repetir stress test con mismos parámetros y evidenciar estabilidad.
3. Verificar nuevamente flujo operativo completo con backup/restore sin inconsistencias.
