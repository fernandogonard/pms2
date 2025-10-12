#!/bin/bash

# Script para sincronizar manualmente el estado de las habitaciones con las reservas activas
# Ejecuta el script de sincronización de estados de habitaciones para corregir inconsistencias

echo "🏨 Sincronizando estados de habitaciones con reservas activas..."

# Ejecutar el script de Node.js
node scripts/syncRoomStatesWithReservations.js

echo "✅ Proceso completado."