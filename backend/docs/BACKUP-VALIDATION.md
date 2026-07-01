# Backup Validation

## Objetivo
Validar en forma repetible que el flujo Backup → Restore deja el sistema operativo y consistente.

## Frecuencia
- Semanal en staging.
- Mensual en producción sobre réplica o entorno aislado.
- Obligatorio antes de cambios de infraestructura de base de datos.

## Prerrequisitos
- Acceso de admin API.
- Base de datos de staging o clon de producción.
- Directorio de backups disponible.

## Flujo de validación

1. Crear backup manual
- Endpoint: POST /api/system/backups/run
- Resultado esperado: success=true y archivo generado.

2. Validar estructura del backup
- Endpoint: GET /api/system/backups/validate-latest
- Resultado esperado: valid=true y arrays rooms/users/clients/reservations.

3. Restaurar en entorno de prueba
- Script: node scripts/restoreBackup.js
- Seleccionar último backup y confirmar restauración.

4. Verificación funcional post-restore
- Login admin funciona.
- GET /api/system/health devuelve status ok o degraded controlado.
- Conteos mínimos:
  - rooms > 0
  - users > 0
- Flujo de negocio mínimo:
  - consultar habitaciones disponibles
  - consultar una reserva existente

5. Registrar evidencia
- Fecha y hora.
- Archivo restaurado.
- Tiempo total de restore (RTO real).
- Diferencia de datos respecto al momento de backup (RPO real).

## Criterios de aceptación
- Backup válido estructuralmente.
- Restore completo sin errores.
- Sistema funcional después de restore.
- RTO menor o igual a 60 minutos.
- RPO menor o igual a 15 minutos para ventanas críticas.

## Fallas comunes
- Backup incompleto por falta de permisos de filesystem.
- Restore sobre base equivocada.
- Datos sensibles no restaurados por cambios de esquema.

## Acciones ante falla
- Bloquear deploy hasta resolver.
- Ejecutar nuevo ciclo completo de backup/restore.
- Registrar incidente y causa raíz.
