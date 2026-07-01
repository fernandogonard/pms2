# TRACEABILITY REPORT (E2E)

## Objetivo
Validar trazabilidad E2E real sin agregar funcionalidades nuevas, correlando:

- requestId enviado/recibido en API (`x-request-id`)
- evento persistido en `audit_logs`
- entidad afectada
- usuario y timestamp

## Contexto de ejecución

- Fecha UTC: 2026-06-16T13:44:05Z
- API: `http://localhost:3001`
- Flujo ejecutado: Login -> Create Reservation -> Update Reservation -> Checkin -> Room Change -> Checkout
- Evidencia bruta: `backend/TRACEABILITY-E2E-RAW.json`

## Evidencia por acción

| Paso | HTTP | requestId (header) | Evento AuditLog | Entidad | entityId | Resultado |
|---|---:|---|---|---|---|---|
| Login | 200 | addb9dc9-7f11-4977-8852-c74ddc34b5d5 | LOGIN | User | 6a15a35ccbe407cb58ba9c6e | Correlación OK |
| Crear reserva | 201 | 934ac883-8772-4a6b-b99b-6bca82c0758f | CREATE_RESERVATION | Reservation | 6a31532539ba3984dd52e9e2 | Correlación OK |
| Modificar reserva | 200 | 7fc4f61f-6da8-42cf-bf55-3fcd609137da | UPDATE_RESERVATION | Reservation | 6a31532539ba3984dd52e9e2 | Correlación OK |
| Checkin | 200 | 79f94ba0-4e0c-4cd3-aca6-513f7f5502d8 | CHECKIN_REALIZADO | Reservation | 6a31532539ba3984dd52e9e2 | Correlación OK |
| Cambio habitación | N/A | N/A | N/A | Reservation | 6a31532539ba3984dd52e9e2 | No ejecutable (sin room alternativa) |
| Checkout | 200 | 94b12c99-b7dc-4b89-b0df-43dc1d476df3 | CHECKOUT_REALIZADO | Reservation | 6a31532539ba3984dd52e9e2 | Correlación OK |

## Resultado de correlación

- Requests con requestId enviados: 5
- Requests con header de respuesta correlado: 5/5
- Eventos AuditLog encontrados por esos requestId: 5
- Tasa de correlación requestId -> AuditLog: 100% para acciones efectivamente ejecutadas

## Hallazgos y huecos

1. El paso de cambio de habitación no se pudo ejecutar porque no hubo habitación alternativa disponible para swap real en ese momento.
2. En audit de reservas se observa `userEmail: "sistema"` para UPDATE/CHECKIN/CHECKOUT, aun cuando el actor fue admin autenticado. Esto no rompe la correlación por requestId, pero reduce fidelidad forense del actor humano.
3. CREATE_RESERVATION aparece como `userRole: "sistema"` (ruta pública), consistente con implementación actual.

## Riesgos pendientes

1. Riesgo de cobertura incompleta del evento `ROOM_CHANGE` bajo condiciones de baja disponibilidad (falta escenario controlado con al menos 2 rooms elegibles).
2. Riesgo de atribución parcial del actor en auditoría (`userEmail` no siempre refleja el usuario autenticado).

## Verificación rápida de open handles

Se ejecutó:

`npx jest tests/unit/systemController.test.js tests/integration/systemRoutes.integration.test.js --detectOpenHandles --coverage=false`

Resultado:

- 2 suites pasadas
- 12 tests pasados
- sin reportes de open handles en esta suite crítica

## Conclusión

La trazabilidad E2E quedó validada para las acciones ejecutadas (login, create, update, checkin, checkout) con correlación consistente de `x-request-id` y persistencia en `audit_logs`.

El único hueco operativo detectado en esta corrida fue la imposibilidad de ejecutar swap de habitación por disponibilidad, no por falla de correlación ni por error de instrumentación.
