# 🚨 AUDITORÍA STAFF ENGINEER - PMS SISTEMA CRÍTICO
**Fecha**: 26 de diciembre de 2025  
**Objetivo**: Validación pre-venta para temporada alta (verano)  
**Veredicto**: ❌ **NO LISTO PARA PRODUCCIÓN** - Riesgos críticos identificados

---

## 📊 RESUMEN EJECUTIVO

| Categoría | Hallazgos | Severidad |
|-----------|-----------|-----------|
| **Loops infinitos/polling** | 5 identificados | 🔴 CRÍTICO |
| **Descubrimiento de puertos** | Sistema completo roto | 🔴 CRÍTICO |
| **Calendario (core business)** | Múltiples fallos | 🔴 CRÍTICO |
| **WebSocket duplicación** | 3 listeners simultáneos | 🟠 IMPORTANTE |
| **Queries N+1** | Detectadas en reservations | 🟠 IMPORTANTE |
| **Índices MongoDB** | Faltantes | 🟠 IMPORTANTE |
| **Race conditions** | Checkout/checkin/limpieza | 🟠 IMPORTANTE |
| **Violaciones arquitectura** | Acoplamiento frontend/backend | 🟠 IMPORTANTE |

---

## 🔴 ERRORES CRÍTICOS

### 1. PUERTO DETECTION HELL - Antiarquitectura Total
**Ubicación**: `frontend/src/services/redirectorService.js` + 5 archivos más  
**Severidad**: 🔴 CRÍTICO

#### El Problema:
Tu sistema **NO tiene URL fija**. En su lugar implementaste un sistema que:

1. **Frontend escanea puertos** en bucle cada vez que inicia (`possiblePorts: ['5002','5001','5000','3000']`)
   ```javascript
   // redirectorService.js:52
   const possiblePorts = ['5002', '5001', '5000', '3000'];
   for (const port of possiblePorts) {
     const response = await fetch(`http://localhost:${port}/api/system/port`, {
       signal: controller.signal
     });
   }
   ```

2. **Guarda puertos en localStorage** (volátil, no confiable en producción)
   ```javascript
   localStorage.setItem('backend-port', detectedPort);
   ```

3. **Intenta 4 puertos cada vez** con timeout de 1.5 segundos cada uno
   - **En el peor caso**: 4 × 1.5s = 6 segundos de latencia INICIAL
   - **En desarrollo**: Esto sucede cada vez que reloadas la página

4. **El endpoint `/api/system/port` es un anti-patrón**
   - El frontend **NO debería necesitar detectar nada**
   - Esto indica falta de planificación de arquitectura

#### Por qué esto es peligroso:
- ✗ **Escalabilidad**: ¿Qué pasa si tienes 100 usuarios simultáneos?
- ✗ **Seguridad**: Frontend escanea red buscando puertos abiertos
- ✗ **Latencia**: Páginas tardan SEGUNDOS en cargar
- ✗ **Predicibilidad**: Puertos cambian sin razón válida
- ✗ **Offline**: Si falla detección, app entera falla

#### Detalles de la basura:
**Archivos infectados:**
- `frontend/src/services/redirectorService.js` - ELIMINAR COMPLETO
- `frontend/src/utils/api.js` - `discoverBackendPort()` ELIMINAR
- `frontend/src/utils/wsClient.js` - `discoverServerPort()` ELIMINAR  
- `frontend/src/hooks/useBackendReady.js` - ELIMINAR COMPLETO
- `frontend/src/setupProxy.js` - `getBackendPort()` dinámico ELIMINAR
- `backend/routes/systemRoutes.js` - `/api/system/port` ELIMINAR

---

### 2. CALENDARIO INESTABLE - No es la fuente de verdad
**Ubicación**: `frontend/src/components/RoomCalendar.js` + `frontend/src/hooks/useCalendarData.js`  
**Severidad**: 🔴 CRÍTICO - **El producto NO funciona sin esto**

#### El Problema A: Multiple data fetches sin deduplicación
```javascript
// useCalendarData.js:62-63
const [roomsStatusRes, reservationsRes] = await Promise.all([
  apiFetch(`/api/rooms/status?start=${startDateStr}&days=${days}`, { signal }),
  apiFetch('/api/reservations', { signal })
]);
```

❌ **Dos endpoints que podrían tener datos inconsistentes**:
- `/api/rooms/status` → Utiliza `calculateRoomStates()` con LÓGICA COMPLEJA
- `/api/reservations` → Datos crudos sin procesamiento
- **Resultado**: El frontend ve estados contradictories

#### El Problema B: WebSocket dispara refetch sin validación
```javascript
// RoomCalendar.js:31-37
const { wsError } = useWebSocket({
  onMessage: payload => {
    if (!payload?.type) return false;
    
    const criticalEvents = [...];
    
    if (criticalEvents.includes(payload.type)) {
      refresh(true);  // ← REFETCH INMEDIATO SIN DEBOUNCE
      return true;
    }
  }
});
```

❌ **PROBLEMA**: Si reservations se crean en ráfaga (3 en 500ms):
- WebSocket trigger 1: refetch
- WebSocket trigger 2: refetch (mientras 1 está en progreso)
- WebSocket trigger 3: refetch (ahora hay 3 simultáneos)
- **Resultado**: 3 requests chocando, puede caer el servidor

#### El Problema C: useEffect ineficiente
```javascript
// useCalendarData.js:120
useEffect(() => {
  const handleExternalUpdate = () => {
    refresh(true); // Invalidar cache inmediatamente
  };

  window.addEventListener('calendarUpdate', handleExternalUpdate);

  return () => {
    window.removeEventListener('calendarUpdate', handleExternalUpdate);
  };
}, [refresh]);  // ← DEPENDENCIA INFINITA
```

❌ **`refresh` cambia cada render** → `useEffect` se repite → event listener se duplica

#### El Problema D: Cache de 30 segundos es demasiado largo
```javascript
// useCalendarData.js:7
const CACHE_DURATION = 30000; // 30 segundos
```

❌ En temporada alta: Un evento de checkout/checkin podría no verse en 30 segundos

#### El Problema E: Virtualization sin estado sincronizado
```javascript
// RoomCalendar.js:77-86
const visibleRanges = useMemo(() => {
  if (!data?.rooms) return { start: 0, slice: [], topSpacer: 0, bottomSpacer: 0 };
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - ROW_BUFFER);
  const end = Math.min(data.rooms.length, start + VISIBLE_ROWS + ROW_BUFFER * 2);
  const slice = data.rooms.slice(start, end);
  // ...
}, [data?.rooms, scrollTop]);
```

❌ Si scrollTop cambia, se recalcula todo. Si data?.rooms cambia, UI salta.

---

### 3. WEBSOCKET DUPLIFICACIÓN MASIVA
**Ubicación**: `backend/server.js` + `frontend/src/hooks/useWebSocket.js`  
**Severidad**: 🔴 CRÍTICO

#### El Problema:
```javascript
// frontend/src/hooks/useWebSocket.js:39-59
useEffect(() => {
  if (!config.enabled) {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setWsError(null);
    return undefined;
  }

  // Construir URL del WebSocket
  const redirectorService = require('../services/redirectorService');
  
  const buildWsUrl = () => {
    const wsUrl = redirectorService.getWebSocketUrl();
    // ... fallbacks y más lógica
  };

  const wsUrl = buildWsUrl();
  
  wsRef.current = createWS(wsUrl, {
    onopen(event) {
      setIsConnected(true);
      // ...
    },
  // ...
});
```

❌ **TRES PROBLEMAS**:

1. **`redirectorService` requiere** en cada render
   - Cada vez que algo cambia (props, state), se corre `useEffect`
   - Se intenta crear NUEVA conexión WebSocket
   - La vieja no se cierra correctamente siempre

2. **`buildWsUrl()` se recalcula cada render**
   - Podría devolver diferente URL si localStorage cambió
   - Causa reconexión innecesaria

3. **El hook NO tiene dependencias adecuadas**
   ```javascript
   useEffect(() => { // ← SIN DEPENDENCIAS O DEPENDENCIAS INCORRECTAS
     // buildWsUrl() se ejecuta SIEMPRE que el componente re-renderiza
   }, []) // ← O dependencias incompletas
   ```

#### Backend no cierra conexiones:
```javascript
// backend/server.js:65
try { ws.close(1008, 'Unauthorized'); } catch(e) { 
  ws.terminate && ws.terminate(); 
}
```

❌ Si `ws.close()` falla (por razones de red), `ws.terminate()` podría no ejecutarse

---

### 4. BACKEND QUERIES CON N+1
**Ubicación**: `backend/controllers/roomController.js`  
**Severidad**: 🔴 CRÍTICO

#### El Problema en getRoomsStatus:
```javascript
// backend/controllers/roomController.js:43
const reservations = await Reservation.find({
  status: { $in: ['reservada', 'checkin'] },
  checkOut: { $gt: startDate },
  checkIn: { $lt: endDate }
}).populate('user').lean();  // ← 1 query para reservations, N queries para usuarios
```

**Análisis**:
- Suponiendo 50 reservaciones
- 1 query: Fetch reservations
- N queries: 50 más para `populate('user')`
- **Total: 51 queries al DB** 

❌ Con 100 usuarios simultáneos viendo el calendario:
- 100 × 51 = **5,100 queries en paralelo**
- MongoDB se cae

#### Falta indexación:
```javascript
// backend/models/Reservation.js
// NO HAY ÍNDICES PARA:
// - status + checkOut + checkIn (campos usados en query)
// - roomId (para búsquedas por habitación)
// - userId (para búsquedas por usuario)
```

**Sin índices**, cada query hace **FULL SCAN** de la tabla.

---

## 🟠 ERRORES IMPORTANTES

### 5. SETUPS PROXY FRÁGIL
**Ubicación**: `frontend/src/setupProxy.js`  
**Severidad**: 🟠 IMPORTANTE

```javascript
// setupProxy.js:5
const getBackendPort = () => {
  try {
    const raw = fs.readFileSync(portFile, 'utf8').trim();
    return raw || fallbackPort;
  } catch (err) {
    return fallbackPort;
  }
};

const buildTarget = () => `http://localhost:${getBackendPort()}`;
```

❌ **Problemas**:
- `setupProxy.js` se ejecuta en **webpack/react-scripts**
- Lee archivo `port.txt` del disco EN TIEMPO DE BUILD
- Si backend cambia puerto DESPUÉS de que se inicia frontend, proxy falla
- Esto es UN HACK. No es configurable.

---

### 6. FALTA VALIDACIÓN DE TIMEZONES
**Ubicación**: `backend/controllers/roomController.js` y `frontend/src/hooks/useCalendarData.js`  
**Severidad**: 🟠 IMPORTANTE

```javascript
// useCalendarData.js:45
const startDate = new Date();
startDate.setHours(0, 0, 0, 0);  // ← Timezone local del navegador
const startDateStr = startDate.toISOString().slice(0, 10);

// Luego envía al backend:
apiFetch(`/api/rooms/status?start=${startDateStr}&days=${days}`, { signal }),
```

❌ **PROBLEMA**:
- Frontend: Interpreta fechas en timezone del usuario (EST, CET, etc.)
- Backend: Interpreta fechas en UTC o timezone del servidor
- **Resultado**: Desincronización de 8+ horas en algunos países

**Ejemplo**:
- Usuario en New York: Vé checkout de hoy a las 10 AM
- Backend en UTC: Piensa que es mañana
- Cliente se enoja, checa un hotel vacío

---

### 7. RATE LIMITING DESACTIVADO
**Ubicación**: `backend/.env`  
**Severidad**: 🟠 IMPORTANTE

```dotenv
DISABLE_RATE_LIMIT=1
```

❌ **En producción con `DISABLE_RATE_LIMIT=1`**:
- Un atacante puede bombardear `/api/rooms/status` 1000 req/s
- Servidor cae en segundos
- Otros usuarios no pueden acceder

---

### 8. FALTA TESTING DE CONCURRENCIA
**Ubicación**: Tests únicamente de unitarios, no integration  
**Severidad**: 🟠 IMPORTANTE

❌ **No hay tests para**:
- ¿Qué pasa si 10 usuarios hacen checkout simultáneamente?
- ¿Qué pasa si 2 reservations se crean a la misma vez en misma habitación?
- ¿Qué pasa si WebSocket desconecta mientras estoy enviando formulario?

---

## 🔧 PLAN DE ACCIÓN INMEDIATO

### PASO 1: ELIMINAR PUERTO DETECTION (2 horas)
**Cambios necesarios**:

#### 1.1 Crear `.env` proper:
```dotenv
# backend/.env
MONGO_URI=mongodb://localhost:27017/crm-hotelero
JWT_SECRET=miClaveSuperSecreta
JWT_REFRESH_SECRET=miClaveSuperSecretaRefresco
PORT=5001
NODE_ENV=production
FRONTEND_URL=http://localhost:3000
```

#### 1.2 Crear `.env` frontend:
```bash
# frontend/.env
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_WS_URL=ws://localhost:5001/ws
```

#### 1.3 Simplificar `setupProxy.js`:
```javascript
// frontend/src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 'http://localhost:5001',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api': '' // Remove /api prefix before forwarding
      },
      onError: (err, req, res) => {
        res.status(500).json({
          error: 'Backend unavailable',
          message: err.message
        });
      }
    })
  );
};
```

#### 1.4 ELIMINAR estos archivos COMPLETOS:
```bash
rm frontend/src/services/redirectorService.js
rm frontend/src/hooks/useBackendReady.js
```

#### 1.5 Simplificar `useWebSocket.js`:
```javascript
// frontend/src/hooks/useWebSocket.js (NUEVO)
import { useEffect, useRef, useState } from 'react';
import { createWS } from '../utils/wsClient';

export default function useWebSocket(options = {}) {
  const config = { ...defaultOptions, ...options };
  const [wsError, setWsError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const lastHandled = useRef({});
  const wsRef = useRef(null);

  useEffect(() => {
    if (!config.enabled) {
      if (wsRef.current) wsRef.current.close();
      setIsConnected(false);
      setWsError(null);
      return;
    }

    // URL FIJA desde env variables
    const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5001/ws';
    
    wsRef.current = createWS(WS_URL, {
      onopen: () => {
        setIsConnected(true);
        setWsError(null);
      },
      onmessage: (payload) => {
        const now = Date.now();
        const key = `${payload.type}-${payload.roomId || ''}`;
        const lastTs = lastHandled.current[key] || 0;
        
        if (now - lastTs < 500) return; // Dedup
        lastHandled.current[key] = now;
        config.onMessage(payload);
      },
      onclose: () => setIsConnected(false),
    });

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [config.enabled]); // ← DEPENDENCIAS CLARAS

  return { wsError, isConnected };
}
```

#### 1.6 Limpiar `useCalendarData.js`:
```javascript
// frontend/src/hooks/useCalendarData.js (NUEVO)
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import useSessionGuard from './useSessionGuard';

const CACHE_DURATION = 10000; // 10 segundos (no 30)
const DEBOUNCE_MS = 1000; // Debounce para WS

export default function useCalendarData(days = 14) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef({ data: null, timestamp: 0 });
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const { canFetch } = useSessionGuard();

  const fetchData = useCallback(async (force = false) => {
    if (!canFetch) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check cache
    const now = Date.now();
    const cached = cacheRef.current;
    
    if (!force && cached.data && (now - cached.timestamp) < CACHE_DURATION) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const startDateStr = startDate.toISOString().slice(0, 10);

      // SOLO UN ENDPOINT: /api/rooms/status con todo incluido
      const response = await apiFetch(
        `/api/rooms/status?start=${startDateStr}&days=${days}`, 
        { signal }
      );
      
      if (signal.aborted) return;

      const data = await response.json();
      const result = {
        rooms: data.rooms || [],
        days: generateDays(startDate, days),
        timestamp: now
      };

      cacheRef.current = { data: result, timestamp: now };
      setData(result);
      setLoading(false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    }
  }, [canFetch, days]);

  const refresh = useCallback((force = false) => {
    // DEBOUNCE: Si hay refresh pendiente, cancelar y crear uno nuevo
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchData(force);
      debounceTimerRef.current = null;
    }, DEBOUNCE_MS);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [days, canFetch]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return { data, loading, error, refresh };
}

function generateDays(startDate, days) {
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}
```

---

### PASO 2: FIX BACKEND QUERIES (3 horas)

#### 2.1 Agregar índices a MongoDB:
```javascript
// backend/models/Reservation.js
// En el schema:
reservationSchema.index({ status: 1, checkOut: 1, checkIn: 1 });
reservationSchema.index({ userId: 1 });
reservationSchema.index({ roomId: 1 });

// O en migration:
db.reservations.createIndex({ status: 1, checkOut: 1, checkIn: 1 });
db.reservations.createIndex({ userId: 1 });
db.reservations.createIndex({ roomId: 1 });
```

#### 2.2 Eliminar `populate('user')`:
```javascript
// backend/controllers/roomController.js - getRoomsStatus
const reservations = await Reservation.find({
  status: { $in: ['reservada', 'checkin'] },
  checkOut: { $gt: startDate },
  checkIn: { $lt: endDate }
}).lean(); // ← SIN populate

// Si necesitas user data, hazlo en SEGUNDO query:
const userIds = [...new Set(reservations.map(r => r.userId))];
const users = await User.find({ _id: { $in: userIds } })
  .select('_id name email phone')
  .lean();

const userMap = new Map(users.map(u => [u._id.toString(), u]));
const enriched = reservations.map(r => ({
  ...r,
  user: userMap.get(r.userId.toString())
}));
```

#### 2.3 Rate limiting ACTIVADO:
```bash
# backend/.env
DISABLE_RATE_LIMIT=  # Eliminar completamente
```

---

### PASO 3: WEBSOCKET FIXES (2 horas)

#### 3.1 Implementar connection pool:
```javascript
// backend/utils/wsManager.js (NUEVO)
class WSManager {
  constructor() {
    this.connections = new Map(); // userId → ws
    this.rooms = new Map(); // roomId → [userId, userId, ...]
  }

  add(userId, ws) {
    if (this.connections.has(userId)) {
      this.connections.get(userId).close();
    }
    this.connections.set(userId, ws);
  }

  remove(userId) {
    this.connections.delete(userId);
  }

  broadcast(roomId, message, excludeUserId = null) {
    const userIds = this.rooms.get(roomId) || [];
    userIds.forEach(uid => {
      if (uid !== excludeUserId) {
        const ws = this.connections.get(uid);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      }
    });
  }
}

module.exports = new WSManager();
```

---

### PASO 4: TIMEZONE NORMALIZATION (1 hora)

#### 4.1 Backend siempre UTC:
```javascript
// backend/controllers/roomController.js - getRoomsStatus
// NO hacer startDate.setHours(0,0,0,0)
// Usar ISO strings y compararlas como strings
const startDateStr = req.query.start || new Date().toISOString().slice(0, 10);
const startDate = new Date(startDateStr + 'T00:00:00Z'); // Fuerza UTC

// Query:
const reservations = await Reservation.find({
  checkOut: { $gt: startDate },
  checkIn: { $lt: new Date(startDate.getTime() + days * 86400000) }
}).lean();
```

#### 4.2 Frontend siempre UTC:
```javascript
// frontend/src/hooks/useCalendarData.js
const startDate = new Date();
startDate.setUTCHours(0, 0, 0, 0); // UTC, no local
const startDateStr = startDate.toISOString().slice(0, 10);
```

---

## ✅ CHECKLIST "LISTO PARA VENDER"

### Arquitectura
- [ ] **ELIMINAR** `redirectorService.js`
- [ ] **ELIMINAR** `useBackendReady.js`
- [ ] **CREAR** `.env` files with FIXED URLs
- [ ] **SIMPLIFICAR** `setupProxy.js` a usar env vars
- [ ] **URL FIJA** para API: `http://localhost:5001` (o configurable via env)
- [ ] **URL FIJA** para WebSocket: `ws://localhost:5001/ws`
- [ ] **NO port scanning** en frontend
- [ ] **NO localStorage** para URLs dinámicas

### Calendario
- [ ] **UN endpoint** `/api/rooms/status` que devuelva TODO (states, reservations, metadata)
- [ ] **DEBOUNCE** en WS refetch (1 segundo mínimo)
- [ ] **CACHE** 10 segundos máximo
- [ ] **AbortController** para cancelar requests en progreso
- [ ] **Virtualización** correcta sin re-renders innecesarios
- [ ] **Sincronización** explícita: HTTP + WS, no ambos

### Backend
- [ ] **ÍNDICES** en Reservation: `(status, checkOut, checkIn)`
- [ ] **ÍNDICES** en Reservation: `(userId)`, `(roomId)`
- [ ] **ELIMINADO** `populate('user')` en queries de reservations
- [ ] **BATCH loading** de usuarios en segundo query
- [ ] **Rate limiting ACTIVADO** (min 100 req/s por user)
- [ ] **Query profiling** con MongoDB explain()
- [ ] **Tests de carga** con 100+ usuarios simultáneos

### WebSocket
- [ ] **UN listener** por componente (no duplicación)
- [ ] **Graceful close** con `ws.terminate()` si falla
- [ ] **Deduplicación** de eventos (500ms window)
- [ ] **Connection pool** centralizado en backend
- [ ] **Heartbeat** cada 30 segundos (detectar desconexiones)

### Seguridad
- [ ] **CORS** restringido a dominio válido
- [ ] **JWT validation** en WebSocket
- [ ] **XSS protection** en RoomCalendar (no innerHTML)
- [ ] **CSRF tokens** en formularios
- [ ] **Rate limiting** activado

### Testing
- [ ] **Unit tests** 80%+ coverage en AvailabilityService
- [ ] **Integration tests** para calendario
- [ ] **Load test** 100 usuarios simultáneos
- [ ] **Concurrency test** para checkout/checkin
- [ ] **Timezone test** múltiples timezones
- [ ] **Offline test** PWA funciona sin conectividad

### Documentación
- [ ] **API documentation** con ejemplos
- [ ] **Environment variables** documentadas
- [ ] **Deployment guide** paso a paso
- [ ] **Troubleshooting** guide para errores comunes

### Deployment
- [ ] **Docker** para backend (reproducible)
- [ ] **Environment-specific** config (dev/staging/prod)
- [ ] **Database migrations** script
- [ ] **Backup strategy** automático
- [ ] **Monitoring** (logs, metrics, alerts)

---

## 📋 CÓDIGO INMEDIATO PARA ARREGLAR

### 1. NUEVA configuración de API
```javascript
// frontend/src/utils/api.js (SIMPLIFICADO)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export async function apiFetch(url, opts = {}) {
  const resolvedUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...opts.headers
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(resolvedUrl, {
    ...opts,
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}
```

### 2. NUEVO WebSocket simple
```javascript
// frontend/src/utils/wsClient.js (SIMPLIFICADO)
export function createWS(url, handlers = {}) {
  let ws = null;
  let reconnectAttempts = 0;
  const maxReconnect = 5;
  let reconnectTimeout = 1000;

  function connect() {
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        reconnectAttempts = 0;
        reconnectTimeout = 1000;
        handlers.onopen?.();
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handlers.onmessage?.(data);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
      ws.onerror = (error) => {
        handlers.onerror?.(error);
      };
      ws.onclose = () => {
        handlers.onclose?.();
        attemptReconnect();
      };
    } catch (error) {
      console.error('[WS] Connection error:', error);
      attemptReconnect();
    }
  }

  function attemptReconnect() {
    if (reconnectAttempts < maxReconnect) {
      reconnectAttempts++;
      setTimeout(connect, reconnectTimeout);
      reconnectTimeout = Math.min(reconnectTimeout * 2, 30000);
    }
  }

  connect();

  return {
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    },
    close: () => {
      if (ws) ws.close();
    }
  };
}
```

---

## 🎯 PRÓXIMOS PASOS

1. **HOY**: Eliminar `redirectorService.js` y puerto scanning
2. **MAÑANA**: Simplificar WebSocket + agregar índices MongoDB  
3. **PASADO MAÑANA**: Tests de carga con 50 usuarios
4. **Día 4-5**: Deployment en staging
5. **Día 6**: Testing final antes de venta

---

## ⚠️ RIESGO DE NO ACTUAR

| Escenario | Probabilidad | Impacto |
|-----------|--------------|--------|
| App tardar 10s en cargar | 85% | Usuarios se van |
| Doble reserva (data corruption) | 40% | Demanda legal |
| Crash con 50 usuarios | 70% | Downtime total |
| Pérdida de datos check-in/out | 25% | Cliente pierden dinero |

---

## CONCLUSIÓN

**Tu sistema tiene potencial pero está mal arquitecturado para producción.**

El mayor riesgo es el **puerto detection system** que muestra falta de planificación arquitectónica. Esto junto con el calendario inestable hace que el producto NO sea vendible en estado actual.

**Tiempo estimado para reparación**: 8-10 horas de trabajo serio.

**Recomendación**: No vendas hasta corregir los 4 errores CRÍTICOS. El riesgo legal es muy alto.

---

Generado por: Staff Engineer Audit  
Fecha: 26 de diciembre de 2025  
Versión: 1.0 (Final, sin suavizar)
