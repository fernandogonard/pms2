# STRESS TEST REPORT

## Objetivo
Validar robustez operativa bajo carga con:
- 500 habitaciones
- 1000 reservas
- 50 usuarios concurrentes

## Evidencia
- Script: `backend/scripts/stressTestHardening.js`
- Resultado crudo: `backend/STRESS-TEST-RAW.json`

## Dataset generado
- Habitaciones: 500
- Reservas: 1000
- Clientes: 1000

## Carga ejecutada
- Usuarios concurrentes: 50
- Iteraciones por usuario: 20
- Requests totales: 1000
- Duración total: 1482.58 ms
- Throughput: 674.5 req/s

## Latencias por endpoint
- health:
  - p50: 51.44 ms
  - p95: 175.18 ms
  - p99: 235.58 ms
  - max: 503.76 ms
- availability:
  - p50: 49.66 ms
  - p95: 92.05 ms
  - p99: 112.65 ms
  - max: 125.70 ms
- reservationsList:
  - p50: 50.33 ms
  - p95: 422.39 ms
  - p99: 492.64 ms
  - max: 689.76 ms

## Memoria
- Antes de carga (`/api/system/health`):
  - rssMB: 100.04
  - heapUsedMB: 48.77
- Después de carga (`/api/system/health`):
  - rssMB: 97.91
  - heapUsedMB: 46.15

## Cuellos de botella encontrados
1. Error rate elevado bajo carga:
   - availability: 401/500 en parte de las solicitudes
   - reservationsList: 500 en parte de las solicitudes
   - health: 500 en parte de las solicitudes
2. Aunque las latencias p95 están por debajo de 500 ms en endpoints críticos medidos, los códigos 5xx/401 indican inestabilidad operativa para piloto si no se corrige primero.

## Conclusión
Rendimiento bruto aceptable en latencia para esta escala, pero estabilidad HTTP no aceptable todavía por tasa de errores bajo concurrencia.

Estado:
- performance p95: ACEPTABLE
- estabilidad de respuestas: NO ACEPTABLE
