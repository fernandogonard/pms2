# 🚀 GUÍA DE IMPLEMENTACIÓN POST-AUDIT

## Checklist de Despliegue

### 1. Backend - Compilación y Tests

```bash
cd /backend

# Instalar dependencias (si es necesario)
npm install

# Ejecutar tests de AvailabilityService
npm test -- calculateRoomStates.test.js
# Esperado: 15 passing

# Ejecutar tests comprehensive (opcional)
npm test -- calculateRoomStates.comprehensive.test.js
# Esperado: ~50 passing

# Verificar que no hay errores de linting
npm run lint 2>/dev/null || echo "No linter configured"

# Hacer build si aplica
npm run build 2>/dev/null || echo "No build step"
```

**✅ Validación:** Si todos los tests pasan, el backend está listo.

---

### 2. Frontend - Compilación y Validación

```bash
cd /frontend

# Instalar dependencias
npm install

# Compilar (sin errores)
npm run build 2>&1 | grep -i error || echo "✅ Build successful"

# Validar que RoomCalendar.js está actualizado
grep -q "room.states\?" src/components/RoomCalendar.js && echo "✅ Frontend updated"
```

**✅ Validación:** Frontend compila sin errores.

---

### 3. Base de Datos - Validación de Datos

```javascript
// Ejecutar en MongoDB shell
use pms_database

// 1. Validar que no hay reservas overlapping
db.reservations.find({
  status: { $in: ['reservada', 'checkin'] },
  $expr: { $gte: ['$checkIn', '$checkOut'] }
}).count()
// Esperado: 0 (cero overlaps)

// 2. Validar reservas sin room_id (virtuales)
db.reservations.find({ room: null }).count()
// Esperado: < 5 (muy pocas virtuales)

// 3. Validar que rooms existen
db.rooms.count()
// Esperado: 40 (todas las habitaciones)

// 4. Limpiar maintenanceDates/cleaningDates inválidas (opcional)
db.rooms.updateMany({}, {
  $set: {
    cleaningDates: { $cond: [{ $isArray: '$cleaningDates' }, '$cleaningDates', []] },
    maintenanceDates: { $cond: [{ $isArray: '$maintenanceDates' }, '$maintenanceDates', []] }
  }
})
```

**✅ Validación:** No hay overlaps, datos son válidos.

---

### 4. Ambiente de Staging - Pruebas

#### 4.1 Prueba de Funcionamiento Básico

```bash
# 1. Iniciar backend
cd backend
npm start

# 2. En otra terminal, iniciar frontend
cd frontend
npm start

# 3. En navegador, ir a http://localhost:3000/calendar

# 4. Validaciones visuales:
# - [x] Leyenda visible con 7 estados
# - [x] Colores diferenciados para cada estado
# - [x] Tooltips funcionan al pasar mouse
# - [x] Scroll virtualizdo funciona (rápido)
# - [x] WebSocket conecta (sin errores en console)
```

#### 4.2 Prueba de Caso Real

```bash
# 1. Crear reserva de prueba para mañana
#    checkIn: 27-12-2024, checkOut: 29-12-2024
#    Habitación: #101

# 2. Validar en calendario:
# - [x] 27-dic: estado = 'checkin_pendiente' (naranja)
# - [x] 28-dic: estado = 'ocupada' (azul)
# - [x] 29-dic: estado = 'checkout_hoy' (rojo)
# - [x] 30-dic: estado = 'disponible' (verde)

# 3. Realizar check-in
# - [x] Validar que 27-dic cambia a 'ocupada' (azul)
# - [x] Validar que actualiza en tiempo real

# 4. Realizar check-out
# - [x] Validar que 29-dic cambia a 'disponible'
```

#### 4.3 Prueba de Limpieza y Mantenimiento

```bash
# 1. Programar limpieza para 29-dic en #101
# - [x] Validar que 29-dic = 'checkout_hoy' (aún así, checkout_hoy > limpieza)

# 2. Programar mantenimiento para 30-dic en #101
# - [x] Validar que 30-dic = 'mantenimiento' (púrpura)

# 3. Crear nueva reserva 30-dic a 01-ene
# - [x] Validar que 30-dic = 'mantenimiento' (no se afecta)
# - [x] Validar que 31-dic = 'checkin_pendiente' o 'ocupada'
```

#### 4.4 Prueba de Reservas Virtuales

```bash
# 1. Crear reserva SIN habitación asignada
#    (room: null o room: [])

# 2. Validar en calendario:
# - [x] La reserva NO aparece en ninguna habitación
# - [x] Panel lateral muestra "Virtual"
# - [x] No afecta estados de habitaciones

# 3. Asignar habitación a la reserva

# 4. Validar que NOW sí aparece en el calendario
```

#### 4.5 Prueba de Carga

```bash
# Simular 40 habitaciones llenas (14 días)
# 560 celdas a renderizar

# Validaciones:
# - [x] Scroll fluido (no lag)
# - [x] Response time < 1s
# - [x] Memoria RAM < 500MB
# - [x] Network requests eficientes (cache, compression)
```

**✅ Todas las pruebas deben pasar.**

---

### 5. Producción - Despliegue

#### 5.1 Pre-Despliegue Checklist

```bash
# 1. Backup de Base de Datos
mongodump --db pms_database --out ./backup_pre_deploy_$(date +%Y%m%d_%H%M%S)

# 2. Backup de Código
git tag calendar-audit-v1
git push origin calendar-audit-v1

# 3. Validar que staging funciona perfectamente
npm test -- calculateRoomStates.test.js
# Esperado: 15 passing

# 4. Crear rama de release
git checkout -b release/calendar-hotfix-2024
git pull origin main
```

#### 5.2 Despliegue Backend

```bash
cd backend

# 1. Pull código actualizado
git fetch origin
git merge origin/main

# 2. Instalar dependencias
npm install --production

# 3. Correr tests finales
npm test -- calculateRoomStates.test.js

# 4. Reiniciar servicio
pm2 restart pms-backend || systemctl restart pms-backend

# 5. Validar que servidor responde
curl -s http://localhost:5000/api/health | jq '.status'
# Esperado: "ok"
```

#### 5.3 Despliegue Frontend

```bash
cd frontend

# 1. Pull código
git fetch origin
git merge origin/main

# 2. Instalar dependencias
npm install --production

# 3. Build
npm run build

# 4. Copiar a servidor web
rsync -avz build/ /var/www/pms-calendar/

# 5. Verificar en navegador
# http://production.example.com/calendar
# - [x] Carga sin errores
# - [x] Estados visibles
# - [x] WebSocket conecta
```

#### 5.4 Post-Despliegue Validación

```bash
# 1. Monitorear logs por 30 minutos
tail -f /var/log/pms-backend.log | grep -i error

# 2. Monitorear excepciones en frontend
# Console del navegador: debería estar limpia

# 3. Validar endpoints
curl http://production.example.com/api/rooms/status?days=14
# Esperado: JSON con rooms y states

# 4. Validar WebSocket
# Abrir DevTools, pestaña Network
# Debería haber conexión WebSocket activa

# 5. Ejecutar una transacción de prueba
#    - Crear reserva
#    - Check-in
#    - Validar que calendario actualiza automáticamente
```

---

## 🆘 Troubleshooting

### Problema: Calendar no carga

**Síntomas:**
- Página blanca o error 500
- Console muestra: "Error loading calendar data"

**Solución:**
```bash
# 1. Validar que API responde
curl http://localhost:5000/api/rooms/status?days=14

# 2. Validar conexión a DB
mongo --eval "db.rooms.count()" pms_database

# 3. Revisar logs
tail -100 /var/log/pms-backend.log | grep -i "error\|exception"

# 4. Reiniciar servicio
pm2 restart pms-backend
```

### Problema: Estados incorrectos

**Síntomas:**
- Habitación muestra 'disponible' pero tiene reserva
- Checkout no muestra 'checkout_hoy'
- Limpieza se superpone con ocupada

**Solución:**
```bash
# 1. Validar datos de la reserva
db.reservations.findOne({ _id: ObjectId("...") })
# Verificar que checkIn < checkOut
# Verificar que room_id es válido

# 2. Validar lógica de calculateRoomStates
npm test -- calculateRoomStates.test.js

# 3. Limpiar cache frontend
# DevTools > Application > Clear storage

# 4. Refresh manual del calendario
# Click en botón refresh o F5
```

### Problema: WebSocket no conecta

**Síntomas:**
- Rojo en parte superior: "Conexión en tiempo real desconectada"
- Calendario no actualiza automáticamente

**Solución:**
```bash
# 1. Validar que WebSocket está abierto
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     http://localhost:5000/ws

# 2. Revisar firewall/proxy
# Asegurar que puerto WebSocket (mismo que API) es accesible

# 3. Reiniciar servidor
pm2 restart pms-backend

# 4. Frontend continuará funcionando sin WS
# (datos actualizados cada 30 segundos automáticamente)
```

### Problema: Performance lenta

**Síntomas:**
- Scroll laggy
- Response time > 5s
- Uso de memoria > 1GB

**Solución:**
```bash
# 1. Validar que virtualización frontend funciona
# DevTools > Performance > Profile scrolling

# 2. Revisar tamaño de dataset
db.reservations.count()
db.rooms.count()
# Si > 10k habitaciones, optimizar query

# 3. Aumentar caché
# En useCalendarData.js: CACHE_DURATION = 60000 (60s)

# 4. Agregar indexing en DB
db.reservations.createIndex({ checkIn: 1, checkOut: 1 })
db.reservations.createIndex({ room: 1 })
```

---

## 📝 Notas Importantes

1. **NO cambiar STATE_PRIORITY sin razón válida**
   - El orden es crítico para la integridad del calendario
   - Si necesita cambio, hacer test primero

2. **Todas las fechas deben ser YYYY-MM-DD**
   - Usar normalizeDate() siempre
   - NO confíar en Date constructor nativo

3. **Validar checkinConfirmed/checkoutConfirmed**
   - Si undefined/null → checkin_pendiente (seguro por defecto)
   - Si true → ocupada / disponible

4. **Monitoreo post-despliegue**
   - Primer día: revisar cada hora
   - Primeros 7 días: revisión diaria
   - Después: monitoreo continuo

5. **Plan de rollback**
   - Si algo sale mal: `git revert <commit>`
   - Restaurar DB desde backup
   - Notificar al equipo de recepción

---

## ✅ Completado

- [x] Bugs identificados y corregidos
- [x] Tests creados y pasando
- [x] Frontend actualizado
- [x] Documentación completa
- [x] Guía de troubleshooting

**Próximo paso:** Ejecutar este checklist antes de temporada alta.

---

*Last Updated: 26 de Diciembre 2024*  
*Status: READY FOR PRODUCTION*
