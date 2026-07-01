# DISASTER RECOVERY REPORT

## Objetivo
Validar recuperación ante desastre con evidencia real, cubriendo en una sola secuencia:
- creación de reserva
- backup
- borrado directo en Mongo
- restore
- verificación de integridad
- verificación de auditoría y requestId

## Fecha de ejecución
- 2026-06-16 UTC

## Evidencia técnica
- Fase 1 (pre-restore): [backend/DISASTER-RECOVERY-PHASE1.json](backend/DISASTER-RECOVERY-PHASE1.json)
- Fase 2 (post-restore): [backend/DISASTER-RECOVERY-PHASE2.json](backend/DISASTER-RECOVERY-PHASE2.json)

## Flujo ejecutado
1. Login admin
2. Crear reserva
3. Ejecutar backup manual
4. Borrar reserva directamente en MongoDB
5. Restaurar backup (script interactivo real)
6. Verificar reserva restaurada
7. Verificar AuditLog y requestId

## Resultado por paso
| Paso | Resultado | Evidencia |
|---|---|---|
| Login | OK (200) | requestId correlado |
| Crear reserva | OK (201) | reservationId: 6a3155331519feea264838ef |
| Crear backup | OK (200) | backup_json_20260616-105251.json |
| Borrar en Mongo | OK | deletedCount: 1, postExists: false |
| Restore interactivo | OK | 4/4 reservas restauradas |
| Verificar reserva | OK | reservationExists: true |
| Verificar auditoría/requestId | OK parcial | 2 eventos encontrados |

## Correlación de auditoría
RequestIds usados en la prueba:
- c01a05ab-2354-4174-9d6f-c82c0f32aa79 (login)
- 4389a44b-ff27-4fa2-8c89-f8a72dd4f0c9 (create reservation)
- e9520171-aa4f-4505-b564-81c3b140a481 (create backup)

Eventos AuditLog encontrados:
- LOGIN (User)
- CREATE_RESERVATION (Reservation)

Conteo:
- requestIds enviados: 3
- audit logs correlados por requestId: 2

## Hallazgos
1. La reserva borrada de forma directa en Mongo se recuperó correctamente tras restore.
2. AuditLog se mantuvo consistente para login y creación de reserva durante el desastre.
3. No se observó evento de auditoría para la ejecución de backup manual en esta prueba.

## Conclusión
La prueba de desastre quedó validada para integridad de datos críticos (reserva) y trazabilidad de acciones de negocio (login + create reservation).

Estado:
- Recovery de datos: VALIDADO
- Trazabilidad completa de los 3 requestIds de la secuencia: PARCIAL (2/3)

## Riesgo residual
- Falta auditoría explícita del evento de backup manual para cerrar 3/3 en esta secuencia específica de disaster recovery.
