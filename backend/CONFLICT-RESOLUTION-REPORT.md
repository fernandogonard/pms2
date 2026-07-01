# CONFLICT-RESOLUTION-REPORT

- Fecha: 2026-06-16T16:31:35.794Z
- Modo: production
- Conflictos iniciales: 3
- Conflictos finales: 0
- byType inicial: {"OVERBOOKING":1,"ROOM_BLOCKED_WITH_RESERVATION":2}
- byType final: {}

## Detalle de conflictos y corrección
### OVERBOOKING
- Severidad: critical
- Habitación: #201 (doble)
- RoomId: 6934d6b4032b08295192f34f
- Causa raíz clasificada: dato inconsistente
- Reservas involucradas:
- Reserva 6a3156867979c8ee94090cc5: status=reservada, checkIn=2026-06-23T00:00:00.000Z, checkOut=2026-06-24T00:00:00.000Z, cliente=Trace Final
- Reserva 6a3175ed9fb155dab391b097: status=reservada, checkIn=2026-06-23T16:12:29.634Z, checkOut=2026-06-24T16:12:29.634Z, cliente=Stress User5
- Acciones aplicadas:
- cancel_reservation_for_overbooking: {"action":"cancel_reservation_for_overbooking","reservationId":"6a3156867979c8ee94090cc5","previousStatus":"reservada","newStatus":"cancelada"}

### ROOM_BLOCKED_WITH_RESERVATION
- Severidad: high
- Habitación: #101 (doble)
- RoomId: 6934d65da6edf37767f28c39
- Causa raíz clasificada: bug de negocio
- Reservas involucradas:
- Reserva 6a3175ed9fb155dab391b092: status=reservada, checkIn=2026-06-18T16:12:29.634Z, checkOut=2026-06-19T16:12:29.634Z, cliente=Stress User0
- Acciones aplicadas:
- normalize_room_status_for_active_reservations: {"action":"normalize_room_status_for_active_reservations","roomId":"6934d65da6edf37767f28c39","previousStatus":"mantenimiento","newStatus":"ocupada"}

### ROOM_BLOCKED_WITH_RESERVATION
- Severidad: high
- Habitación: #101 (doble)
- RoomId: 6934d65da6edf37767f28c39
- Causa raíz clasificada: dato inconsistente
- Reservas involucradas:
- Reserva 6a3175ed9fb155dab391b286: status=reservada, checkIn=2026-07-08T16:12:29.634Z, checkOut=2026-07-09T16:12:29.634Z, cliente=Stress User500
- Acciones aplicadas:
- Sin acciones aplicadas

## Resumen de acciones
- cancel_reservation_for_overbooking :: {"action":"cancel_reservation_for_overbooking","reservationId":"6a3156867979c8ee94090cc5","previousStatus":"reservada","newStatus":"cancelada"}
- normalize_room_status_for_active_reservations :: {"action":"normalize_room_status_for_active_reservations","roomId":"6934d65da6edf37767f28c39","previousStatus":"mantenimiento","newStatus":"ocupada"}

## Resultado
- Objetivo alcanzado: 0 conflictos activos.