📅 GUÍA DE INTEGRACIÓN - SISTEMA DE CHECKOUTS PMS2
================================================

## 🎯 ¿Qué se implementó?

Se creó un sistema completo de checkouts anticipados que:
- ✅ Marca habitaciones con checkout a las 7 AM (10 AM checkout time)
- ✅ Muestra dashboard visual de checkouts del día
- ✅ Permite asignar limpieza manualmente a limpiadores
- ✅ Diferencia entre 3 tipos de limpieza (20-40 min)
- ✅ Muestra advertencia de pago pendiente
- ✅ Transiciona habitación de ocupada → limpieza → disponible

---

## 📦 Archivos Creados/Modificados

### BACKEND

**CREADOS:**
- ✅ `backend/services/CheckoutService.js` - Lógica de checkouts
  
**MODIFICADOS:**
- ✅ `backend/models/Room.js` - Agregó campos checkout
- ✅ `backend/constants/businessConstants.js` - Tiempos y config visual
- ✅ `backend/routes/cleaningRoutes.js` - Nuevas rutas API
- ✅ `backend/scheduledJobs.js` - Tareas cron 7 AM y 23:30

### FRONTEND

**CREADOS:**
- ✅ `frontend/src/components/CheckoutDashboard.jsx` - UI principal
- ✅ `frontend/src/styles/CheckoutDashboard.css` - Estilos
- ✅ `frontend/src/constants/businessConstants.js` - Constantes

---

## 🚀 CÓMO USAR

### 1. IMPORTAR EL COMPONENTE EN TU APP

En tu archivo principal (App.jsx o router):

```jsx
import CheckoutDashboard from './components/CheckoutDashboard';

// En tus rutas:
<Route path="/cleaning/checkouts" element={<CheckoutDashboard />} />
```

### 2. AGREGAR LINK EN NAVEGACIÓN

En tu navbar o menu principal, agregar:

```jsx
<NavLink to="/cleaning/checkouts">
  📅 Checkouts de Hoy
</NavLink>
```

### 3. LISTO - El sistema funciona automáticamente

- ✅ A las 7 AM se marcan habitaciones con checkout
- ✅ Users abren dashboard y ven qué habitaciones tienen checkout
- ✅ Asignan limpiadores manualmente
- ✅ Siguen el progreso

---

## 📊 FLUJO DE TRABAJO DIARIO

```
07:00 AM
  ↓
BACKEND: Scheduler marca checkouts
  → Busca reservas con checkOut=hoy
  → Llena Room.checkoutToday=true
  → Guarda guest info en checkoutInfo
  ↓
FRONTEND: Personal abre dashboard
  → CheckoutDashboard carga /api/cleaning/checkouts/today
  → Muestra tarjetas de habitaciones
  ↓
PERSONAL: Asigna limpieza
  → Click "Asignar limpieza"
  → Modal: selecciona limpiador + tipo
  → POST /api/cleaning/:roomId/assign
  ↓
LIMPIADOR: Hace limpieza
  → Click "Iniciar limpieza"
  → PATCH /api/cleaning/:roomId/start
  → Status pasa a "en_progreso"
  ↓
LIMPIADOR: Termina
  → Click "Completar limpieza"
  → PATCH /api/cleaning/:roomId/complete
  → Habitación pasa a "disponible" ✨
  ↓
23:30 PM
  ↓
BACKEND: Scheduler limpia flags
  → Limpia room.checkoutToday=false
  → Reset para mañana
```

---

## 🎨 INTERFAZ VISUAL

### Tarjeta de Checkout

```
┌─────────────────────────────────┐
│ HAB. #203            ✅ PAGADA  │ ← Color morado degradado
├─────────────────────────────────┤
│ Huésped: Juan García            │
│ Noches: 3                       │
│ Total: $450                     │
│                                 │
│ Estado: 📌 Asignada             │
│ Asignado a: María               │
│ 🏃 Checkout limpieza (40 min)   │ ← Naranja
├─────────────────────────────────┤
│     [🧹 Iniciar limpieza]       │ ← Botón contextual
└─────────────────────────────────┘
```

### Indicadores de Pago

**PAGADA:**
```
✅ PAGADA
(badge verde)
```

**PENDIENTE:**
```
⚠️ PENDIENTE: $150
(badge rojo con monto)
```

---

## 🔌 API ENDPOINTS

Todos requieren autenticación JWT (header: `Authorization: Bearer {token}`)

### GET `/api/cleaning/checkouts/today`
Obtiene habitaciones con checkout hoy.

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65abc...",
      "number": 203,
      "status": "ocupada",
      "checkoutToday": true,
      "checkoutInfo": {
        "guestName": "Juan García",
        "totalAmount": 450,
        "amountPaid": 450,
        "isPaid": true,
        "nightsStayed": 3
      },
      "housekeepingAssignment": {
        "status": "no_asignada"
      }
    }
  ],
  "count": 5
}
```

### POST `/api/cleaning/:roomId/assign`
Asigna limpieza a habitación.

**Body:**
```json
{
  "assignedTo": "María",
  "housekeepingType": "limpieza_checkout"
}
```

**housekeepingType opciones:**
- `"repaso"` (20 min)
- `"limpieza_profunda"` (25 min)
- `"limpieza_checkout"` (40 min)

### PATCH `/api/cleaning/:roomId/start`
Marca limpieza como en progreso.

### PATCH `/api/cleaning/:roomId/complete`
Marca limpieza como completada.

**Body (opcional):**
```json
{
  "notes": "Limpieza finalizada sin inconvenientes"
}
```

---

## 🔐 PERMISOS REQUERIDOS

Los endpoints de checkout requieren uno de estos roles:

- `admin` - Acceso completo
- `recepcionista` - Acceso completo
- `limpieza` - Puede ver y marcar como completada (solo GET y PATCH complete)

---

## 📱 TIPOS DE LIMPIEZA VISUAL

| Tipo | Emoji | Color | Duración |
|------|-------|-------|----------|
| Repaso rápido | 🧹 | Azul | 20 min |
| Limpieza profunda | 🧼 | Púrpura | 25 min |
| Checkout limpieza | 🏃 | Naranja | 40 min |

---

## ⚙️ CONFIGURACIÓN

### Cambiar hora de marcado de checkouts

En `backend/constants/businessConstants.js`:
```javascript
BUSINESS_CONFIG: {
  CHECKOUT_TIME: '10:00',       // Hora real de checkout
  CHECKOUT_ALERT_TIME: '07:00'  // Hora de visibilidad en dashboard
}
```

### Cambiar duraciones de limpieza

En `backend/constants/businessConstants.js`:
```javascript
CLEANING_TIMES: {
  repaso: 20,           // minutos
  limpieza_profunda: 25,
  limpieza_checkout: 40
}
```

---

## 🧪 TESTING RÁPIDO

### 1. Ver si scheduler arranca
```bash
# Logs al iniciar servidor
# Deberías ver:
# 📋 Sistema de tareas programadas iniciado correctamente
# ...
# 🆕 [CHECKOUT] Marcar checkouts: 7:00 AM (visibilidad anticipada)
# 🆕 [CHECKOUT] Limpiar flags: 23:30 PM (preparar siguiente día)
```

### 2. Abrir dashboard
```
http://localhost:3000/cleaning/checkouts
```

### 3. Probar asignación
```bash
curl -X POST http://localhost:5000/api/cleaning/{roomId}/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "assignedTo": "María",
    "housekeepingType": "limpieza_checkout"
  }'
```

### 4. Probar inicio de limpieza
```bash
curl -X PATCH http://localhost:5000/api/cleaning/{roomId}/start \
  -H "Authorization: Bearer {token}"
```

### 5. Probar completación
```bash
curl -X PATCH http://localhost:5000/api/cleaning/{roomId}/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"notes": "Completada"}'
```

---

## 🐛 TROUBLESHOOTING

### El dashboard no muestra checkouts
**Causa:** No ha llegado las 7 AM o no hay checkouts programados
**Solución:** Ejecutar manualmente en servidor:
```javascript
const CheckoutService = require('./services/CheckoutService');
await CheckoutService.markRoomsWithCheckoutToday();
```

### Los botones no funcionan
**Causa:** Token expirado o permisos insuficientes
**Solución:** Verificar localStorage token y que usuario tenga rol correcto

### Las limpiezas no aparecen en la habitación
**Causa:** Cache del frontend
**Solución:** Forzar refresco con F5 o esperar 30 segundos (auto-refresco)

---

## 📈 ESTADÍSTICAS

Accesible vía:
```bash
GET /api/cleaning/stats
```

Retorna:
```json
{
  "totalChecks": 15,
  "assignedCleaning": 12,
  "inProgress": 3,
  "completed": 5
}
```

---

## 🎓 CAPACITACIÓN DEL PERSONAL

### Para Recepcionistas:
1. Abrir dashboard a las 7 AM
2. Ver qué habitaciones tienen checkout
3. Asignar limpiadores disponibles
4. Seguir progreso durante el día

### Para Limpiadores:
1. Reciben asignación en app
2. Hacen click "Iniciar limpieza"
3. Hacen el trabajo (20-40 min según tipo)
4. Hacen click "Completar limpieza"
5. Sistema marca habitación como disponible

### Para Gerentes:
1. Dashboard muestra todos los checkouts
2. Pueden ver estado en tiempo real
3. Pueden reasignar si es necesario
4. Reportes de timings

---

## 📝 NOTAS IMPORTANTES

✅ **Ya está todo funcionando automáticamente**
- No necesitas hacer nada más, el sistema ya está integrado
- Solo necesitas importar el componente en tu router

⚠️ **Asegurate de:**
- Que `node-cron` esté en package.json (generalmente ya lo está)
- Que el servidor esté corriendo en el horario de prueba

🔄 **Auto-refresh:**
- Dashboard actualiza cada 30 segundos
- No necesita F5, los cambios aparecen automáticamente

🌙 **Al final del día:**
- A las 23:30 se limpian los flags automáticamente
- Mañana a las 7 AM se marcan nuevos checkouts
- El ciclo se repite

---

**¿Preguntas?**
Consult la documentación técnica en:
`/memories/session/pms2-checkout-implementation.md`
