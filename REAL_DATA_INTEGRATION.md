# Integración con datos reales / Producción

Esta es la guía para cuando se disponga de:
- datos de facturación reales (CUIT, punto de venta, tipo de comprobante)
- servidor backend real o MongoDB Atlas
- pasarela de pago real (MercadoPago, Stripe, TodoPago, etc.)

## Qué se debe proveer

1. MongoDB real
   - `MONGO_URI` en `backend/config/.env`
   - Cluster Atlas o servidor propio

2. Claves de seguridad
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - si usan Sentry u otro monitoreo: `SENTRY_DSN`

3. URLs y dominios de producción
   - dominio frontend: Ej. `https://crm.tuhotel.com`
   - dominio backend: Ej. `https://api.crm.tuhotel.com`
   - `CORS_ORIGIN` y `REACT_APP_API_URL`

4. Pasarela de pagos
   - proveedor elegido
   - credenciales: `API_KEY`, `CLIENT_ID`, `CLIENT_SECRET`, etc.
   - webhook URL o callback URL
   - métodos aceptados: `tarjeta`, `transferencia`, `efectivo`, `debito`

5. Datos de facturación
   - CUIT
   - Razón social
   - Domicilio fiscal
   - Condición frente al IVA
   - Punto de venta y tipo de comprobante
   - Si se requiere CAE/AFIP en línea

## Cómo pedirlo

Proponé el cambio con un texto claro como este:

> "Quiero activar producción real. Tengo MongoDB Atlas, CUIT y pasarela de pago. Necesito:
> - configuración de deploy productivo
> - integración de pago real en `billing`
> - facturación oficial con CUIT/punto de venta
> - mantener el demo separado"

## Qué se hará cuando se tenga todo

- configurar el backend para producción
- mantener el demo en `demo/` con datos de prueba
- activar la pasarela real solo en producción
- adaptar la facturación para emitir comprobantes con CUIT/punto de venta
- validar la URL del frontend y el CORS
- dejar el sistema listo para desplegar con datos reales

## Nota

El objetivo es no mezclar:
- demo local / datos falsos
- producción real / datos legítimos

Por eso es importante mantener:
- `demo/` para presentaciones
- el backend principal listo para `NODE_ENV=production`
