# EVENT MATRIX CORE - DÍA 2

## Alcance
Implementación backend-only del núcleo Event Matrix, sin integración con frontend, RoomCalendar, WebSocket ni reemplazo de AvailabilityEngine.

## Archivos creados
- `backend/models/eventTypes.js`
- `backend/models/RoomEvent.js`
- `backend/services/eventMatrixService.js`
- `backend/tests/unit/eventMatrixService.test.js`

## Qué hace el núcleo
`EventMatrixService` resuelve timeline por habitación y día (24 slots por hora) a partir de eventos:

1. Recibe eventos (`setEvents`, `receiveEvents`).
2. Ordena cronológicamente.
3. Indexa por:
   - room (`eventsByRoom`)
   - date (`eventsByDate`)
   - room+date (`eventsByRoomAndDate`)
4. Construye timeline horario (`buildDayTimeline(roomId, date)`).
5. Resuelve estado dominante por prioridad (`resolveDominantStatus`).
6. Cachea resultados por `roomId|date` con invalidación incremental.

## Tipos de evento soportados
- CHECKIN
- CHECKOUT
- RESERVATION_CREATED
- RESERVATION_MODIFIED
- RESERVATION_CANCELLED
- CLEANING_START
- CLEANING_END
- MAINTENANCE_START
- MAINTENANCE_END
- OUT_OF_ORDER_START
- OUT_OF_ORDER_END
- ROOM_BLOCK_START
- ROOM_BLOCK_END

## Estados soportados
- FREE
- RESERVED
- CHECKIN
- CHECKOUT
- OCCUPIED
- CLEANING
- MAINTENANCE
- OUT_OF_ORDER

## Prioridades implementadas
- OUT_OF_ORDER = 100
- MAINTENANCE = 90
- CHECKOUT = 70
- CHECKIN = 60
- OCCUPIED = 50
- RESERVED = 40
- CLEANING = 30
- FREE = 10

## Índices y performance
- Índices Mongoose en `RoomEvent`:
  - `{ roomId: 1, timestamp: 1 }`
  - `{ timestamp: 1 }`
  - `{ roomId: 1, type: 1, timestamp: 1 }`
- Índices en memoria O(1) por `Map`:
  - `eventsByRoom`
  - `eventsByDate`
  - `eventsByRoomAndDate`
- Cache incremental en `Map`:
  - key: `roomId|date`
  - invalidación por eventos entrantes y rangos `checkIn/checkOut` en metadata
- Evita `Array.find()` dentro de loops de render para lookup crítico.

## Tests ejecutados
Archivo:
- `backend/tests/unit/eventMatrixService.test.js`

Cobertura de casos solicitados:
1. Timeline simple checkin-checkout.
2. Limpieza entre huéspedes.
3. Mantenimiento.
4. Habitación fuera de servicio.
5. Resolución de prioridades.
6. Cache hit.
7. Cache invalidation.

Resultado:
- 8/8 tests en verde.

## Cobertura (servicio)
Comando:
`npx jest tests/unit/eventMatrixService.test.js --coverage --collectCoverageFrom=services/eventMatrixService.js`

Resultado:
- Statements: 87.04%
- Branches: 77.3%
- Functions: 100%
- Lines: 87.5%

## Validación de no regresión inmediata
Comando:
`npx jest tests/unit/eventMatrixService.test.js tests/unit/conflictDetectorService.test.js --coverage=false`

Resultado:
- 13/13 tests en verde (Event Matrix + Conflict Detector)

## Riesgos detectados
1. Semántica de transición real aún depende de origen de eventos.
   - El motor asume que los eventos llegan correctamente tipados y con timestamp confiable.
2. Resolución diaria UTC.
   - Hoy el timeline usa día UTC; para operación local podría requerir timezone configurable.
3. Integración pendiente.
   - Aún no consume eventos reales de reservas/mantenimiento automáticamente.

## Próximos pasos
1. Definir pipeline de emisión de `RoomEvent` desde controladores/servicios backend.
2. Agregar pruebas de regresión con secuencias largas multi-día.
3. Integrar lectura de Event Matrix en un endpoint backend interno (sin tocar frontend todavía).
4. Recién después evaluar sustitución progresiva de fuentes actuales de estado.
