# OUT_OF_ORDER-VALIDATION

## Objetivo
Validar que el estado out_of_order ("fuera de servicio") quede soportado de forma consistente en backend para el flujo operativo del piloto PMS.

## Decisión técnica aplicada
Se aplicó Opcion A: incorporar estado explicito de habitacion fuera de servicio en el dominio de estados del backend.

## Cambios implementados
1. Se agrego `FUERA_DE_SERVICIO: 'fuera de servicio'` al catalogo de estados de habitacion.
2. Se habilitaron transiciones validas para `FUERA_DE_SERVICIO` en el validador de estados.
3. Se robustecio el runner operativo para evaluar el paso out_of_order dentro del flujo E2E.

## Evidencia ejecutada
1. Verificacion API directa:
   - Request: `PUT /api/rooms/:id` con body `{ "status": "fuera de servicio" }`
   - Resultado: HTTP 200 OK
2. Validacion operativa automatizada:
   - Comando: `npm run ops:validate`
   - Salida resumen actual: `goNoGo=GO`, `passed=18`, `failed=0`, `blocked=0`
   - Paso `out_of_order`: PASSED
3. Estado de conflictos:
   - Conflictos activos previamente resueltos: 0 activos tras resolucion

## Resultado
Out_of_order queda validado y operativo en backend para el piloto, sin bloqueadores en la corrida actual de validacion operativa.

## Nota de seguimiento
Persisten hallazgos observacionales en RoomEvents/AuditLog/EventMatrix para la reserva de validacion (no bloqueantes para esta decision), registrados en el reporte operativo actual.
