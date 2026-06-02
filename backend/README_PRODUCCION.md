# README_PRODUCCION.md — PMS Diva Backend

Guía completa para desplegar, operar y mantener el backend en producción.

---

## Índice

1. [Stack técnico](#1-stack-técnico)
2. [Variables de entorno](#2-variables-de-entorno)
3. [Instalación local](#3-instalación-local)
4. [Deploy en Railway](#4-deploy-en-railway)
5. [Frontend en Vercel](#5-frontend-en-vercel)
6. [MongoDB Atlas](#6-mongodb-atlas)
7. [Mercado Pago](#7-mercado-pago)
8. [Emails (SMTP)](#8-emails-smtp)
9. [Seguridad](#9-seguridad)
10. [Monitoreo y logs](#10-monitoreo-y-logs)
11. [Backups](#11-backups)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Stack técnico

| Componente | Tecnología |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4.21 |
| Base de datos | MongoDB 6+ / Mongoose 7 |
| Auth | JWT (15m) + Refresh tokens (7d) en httpOnly cookies |
| Realtime | WebSocket (ws 8) |
| Pagos | Mercado Pago SDK v2 |
| Emails | Nodemailer |
| Logs | Winston (una sola instancia) |
| Deploy | Railway (backend) + Vercel (frontend) |

---

## 2. Variables de entorno

Copiar `config/.env.example` a `config/.env` (local) o configurar en Railway/Vercel.

### Variables obligatorias en producción

```env
# MongoDB
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/pms?retryWrites=true&w=majority

# JWT — GENERAR CON: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64_bytes_hex>
JWT_REFRESH_SECRET=<64_bytes_hex_diferente>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://tu-frontend.vercel.app

# App
NODE_ENV=production
PORT=5001
BACKEND_URL=https://tu-backend.railway.app
FRONTEND_URL=https://tu-frontend.vercel.app

# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-...
MP_PUBLIC_KEY=APP_USR-...
MP_WEBHOOK_SECRET=<secreto_generado>

# Email (ej. Brevo / Mailgun / Gmail)
EMAIL_HOST=smtp.brevo.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=<api_key>
EMAIL_FROM=Hotel Diva <noreply@hoteldiva.com>

# Hotel
HOTEL_NAME=Hotel Diva
HOTEL_ADDRESS=Mar del Plata, Buenos Aires
HOTEL_PHONE=+54 9 223 ...
HOTEL_EMAIL=info@hoteldiva.com
HOTEL_WEBSITE=https://hoteldiva.com
```

### Cómo generar secretos JWT seguros

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Ejecutar **dos veces** — una para `JWT_SECRET` y otra para `JWT_REFRESH_SECRET`.

---

## 3. Instalación local

```bash
cd pms2/backend
npm install
cp config/.env.example config/.env
# editar config/.env con valores locales
node server.js
# o con nodemon:
npx nodemon server.js
```

El servidor escucha en `http://localhost:5001`.

---

## 4. Deploy en Railway

### Prerequisitos
- Cuenta en [railway.app](https://railway.app)
- CLI: `npm install -g @railway/cli` y `railway login`

### Pasos

1. Desde la raíz del proyecto:
   ```bash
   railway init
   railway link <proyecto>
   ```

2. Configurar variables de entorno en el dashboard de Railway (todas las listadas en §2).

3. Asegurarse de que `package.json` tiene el `start` script:
   ```json
   "scripts": { "start": "node server.js" }
   ```

4. Deploy:
   ```bash
   railway up
   ```

### Healthcheck

Railway detecta automáticamente el puerto desde `PORT`. El endpoint `/api/health` (o `/`) devuelve 200 si el servidor está up.

### WebSocket en Railway

Railway soporta WebSocket nativamente. No requiere configuración adicional. La URL WS del frontend debe ser `wss://tu-backend.railway.app/ws`.

---

## 5. Frontend en Vercel

1. En el dashboard de Vercel, agregar variable de entorno:
   ```
   VITE_API_URL=https://tu-backend.railway.app/api
   VITE_WS_URL=wss://tu-backend.railway.app/ws
   ```

2. El `vercel.json` (si existe) ya tiene las rewrites necesarias.

---

## 6. MongoDB Atlas

### Crear cluster (gratis M0)

1. Registrarse en [mongodb.com/atlas](https://mongodb.com/atlas)
2. Crear cluster M0 (Free Tier)
3. En **Database Access**: crear usuario con rol `readWrite` sobre la base `pms`
4. En **Network Access**: agregar `0.0.0.0/0` (Railway IPs son dinámicas) o los IPs específicos de Railway
5. Copiar la Connection String y asignarla a `MONGO_URI`

### Índices ya configurados en el modelo

Los modelos `Reservation` y `Room` ya tienen los índices necesarios definidos en el schema Mongoose. Se crean automáticamente en la primera conexión.

---

## 7. Mercado Pago

### Configuración

1. Crear aplicación en [developers.mercadopago.com](https://developers.mercadopago.com)
2. Obtener `Access Token` de producción y `Public Key`
3. Configurar el webhook en el panel MP:
   - URL: `https://tu-backend.railway.app/api/payments/webhook`
   - Eventos: `payment`
4. Copiar el `Webhook Secret` a `MP_WEBHOOK_SECRET`

### Flujo de pagos

```
Frontend                Backend                   Mercado Pago
   |                        |                           |
   |-- POST /api/payments/preference -->|               |
   |                        |-- createPreference() -->  |
   |                        |<-- preference_id ------   |
   |<-- { init_point } -----|                           |
   |                        |                           |
   |-- redirect to MP payment form ------------------> |
   |                        |                           |
   |                        |<-- POST /api/payments/webhook (MP notifica) 
   |                        |-- verifyWebhookSignature()
   |                        |-- processWebhook()
   |                        |-- update reservation.payment
```

### Porcentajes

| Tipo | Porcentaje |
|---|---|
| `sena` | 30% del total |
| `total` | 100% |
| `saldo` | monto restante |

---

## 8. Emails (SMTP)

### Proveedores recomendados (plan gratuito)

| Proveedor | Free tier | Config |
|---|---|---|
| [Brevo](https://brevo.com) | 300 emails/día | smtp.brevo.com:587 |
| [Mailgun](https://mailgun.com) | 1000 emails/mes | smtp.mailgun.org:587 |
| Gmail | 500/día | smtp.gmail.com:587 (requiere App Password) |

### Emails implementados

- **Confirmación de reserva** — se envía automáticamente al crear una reserva
- **Check-in reminder** — 1 día antes del check-in (programar con cron)
- **Agradecimiento por checkout** — al procesar el checkout
- **Reseteo de contraseña** — desde el flujo de auth
- **Recibo de pago** — al confirmar un pago de MP

### Deshabilitar emails temporalmente

Simplemente no configurar las variables `EMAIL_*`. El servicio detecta la ausencia de config y skippea el envío silenciosamente (sin crashear).

---

## 9. Seguridad

### Checklist de producción

- [ ] `JWT_SECRET` y `JWT_REFRESH_SECRET` son valores aleatorios (64 bytes hex), NO placeholders
- [ ] `CORS_ORIGIN` apunta exclusivamente al dominio del frontend (sin `*`)
- [ ] `NODE_ENV=production`
- [ ] MongoDB con autenticación habilitada (Atlas la habilita por defecto)
- [ ] Webhook de MP verificado con HMAC-SHA256 (`MP_WEBHOOK_SECRET` configurado)
- [ ] `config/.env` NO está commiteado (ver `.gitignore`)
- [ ] Rate limiting activo (120 req/min por usuario)
- [ ] Helmet CSP configurado (incluye `wss:` para WebSocket)

### Middleware de seguridad (stack)

```
Request
  → Helmet (headers + CSP)
  → CORS (origen restringido)
  → express-mongo-sanitize (prevent NoSQL injection)
  → xss-clean (prevent XSS)
  → advancedSecurity (rate limit por usuario + anomaly detection)
  → express-rate-limit (rate limit general)
  → JWT auth (rutas protegidas)
```

---

## 10. Monitoreo y logs

### Logs en Railway

Railway captura todo stdout/stderr. El logger Winston escribe a `process.stdout` en producción (no a archivos, que no son persistentes).

### Niveles de log

| Nivel | Cuándo |
|---|---|
| `error` | Errores no recuperables, fallos de DB |
| `warn` | Anomalías, intentos de auth fallidos, rate limits |
| `info` | Operaciones normales (reservas, pagos, auth) |
| `debug` | Solo en desarrollo |

### Sentry (opcional)

Configurar `SENTRY_DSN` para captura automática de errores en producción.

---

## 11. Backups

### MongoDB Atlas — backups automáticos

Atlas M0 (free) no incluye backups automáticos. Opciones:

**Opción A — Atlas M10+ ($57/mes):** Backups continuos y point-in-time recovery.

**Opción B — Script manual (gratis):**

```bash
# Requiere mongodump instalado
mongodump --uri="<MONGO_URI>" --out="./backup-$(Get-Date -Format 'yyyyMMdd')"
```

Agregar al cron del servidor o ejecutar manualmente antes de cada deploy.

**Opción C — Railway cron job:**

Crear un servicio separado en Railway que ejecute el script de backup periódicamente y suba a S3/Google Cloud Storage.

---

## 12. Troubleshooting

### Error: "JWT secret is using placeholder value"

El servidor bloquea el inicio en producción si `JWT_SECRET` sigue siendo el valor por defecto.  
**Solución:** Generar secretos reales con `crypto.randomBytes(64).toString('hex')` y configurarlos en Railway.

### Error: "MongoServerError: bad auth"

Las credenciales de Atlas son incorrectas o el usuario no tiene permisos sobre la base `pms`.  
**Solución:** Verificar usuario/contraseña en Atlas → Database Access.

### Error: "CORS policy: blocked"

`CORS_ORIGIN` no coincide con el origen del frontend.  
**Solución:** Verificar que `CORS_ORIGIN=https://tu-frontend.vercel.app` (sin barra final).

### WebSocket no conecta en producción

Verificar que `VITE_WS_URL` usa `wss://` (no `ws://`) en producción.  
Railway requiere WSS para conexiones seguras.

### Emails no llegan

1. Verificar que `EMAIL_HOST/PORT/USER/PASS` están configurados.
2. Revisar logs por `[emailService]`.
3. Verificar que el proveedor SMTP no tenga el envío bloqueado (límite diario, verificación de dominio).

### Webhook de Mercado Pago retorna 401

`MP_WEBHOOK_SECRET` no coincide con el configurado en el panel de MP.  
**Solución:** Regenerar el secreto en MP y actualizar la variable en Railway.

### Rate limit 429 en endpoints de la API

El sistema tiene 120 req/min por usuario y 100 req/15min general.  
En desarrollo, reducir los límites temporalmente en `config/rateLimiter.js`.

---

*Generado el: 2025 — PMS Diva Backend v1.0 producción*
