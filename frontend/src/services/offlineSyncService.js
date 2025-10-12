// Servicio de sincronización offline para CRM Hotelero
// Maneja la cola de acciones pendientes y sincronización automática

class OfflineSyncService {
  constructor() {
    this.syncQueue = [];
    this.isProcessing = false;
    this.listeners = [];
    this.loadQueue();
    
    // Procesar cola automáticamente cuando vuelva la conexión
    window.addEventListener('online', () => {
      setTimeout(() => this.processQueue(), 1000);
    });
    
    // Procesar cola periódicamente si estamos online
    setInterval(() => {
      if (navigator.onLine && this.syncQueue.length > 0) {
        this.processQueue();
      }
    }, 30000); // Cada 30 segundos
  }

  // Cargar cola desde localStorage
  loadQueue() {
    try {
      const saved = localStorage.getItem('crm-sync-queue');
      if (saved) {
        this.syncQueue = JSON.parse(saved);
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
      this.syncQueue = [];
    }
  }

  // Guardar cola en localStorage
  saveQueue() {
    try {
      localStorage.setItem('crm-sync-queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  // Añadir acción a la cola
  addToQueue(action) {
    const queueItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: action.type || 'unknown',
      url: action.url,
      method: action.method || 'POST',
      data: action.data,
      headers: action.headers || {},
      retries: 0,
      maxRetries: 3,
      ...action
    };

    this.syncQueue.push(queueItem);
    this.saveQueue();
    this.notifyListeners();

    console.log(`[OfflineSync] Added to queue: ${queueItem.type} - ${queueItem.id}`);
    return queueItem.id;
  }

  // Procesar cola de sincronización
  async processQueue() {
    if (this.isProcessing || !navigator.onLine || this.syncQueue.length === 0) {
      return;
    }

    console.log(`[OfflineSync] Processing ${this.syncQueue.length} items`);
    this.isProcessing = true;

    const processed = [];
    const failed = [];

    for (const item of [...this.syncQueue]) {
      try {
        await this.processSyncItem(item);
        processed.push(item.id);
        console.log(`[OfflineSync] Processed: ${item.type} - ${item.id}`);
      } catch (error) {
        console.error(`[OfflineSync] Failed: ${item.type} - ${item.id}`, error);
        
        // Incrementar contador de reintentos
        const itemIndex = this.syncQueue.findIndex(q => q.id === item.id);
        if (itemIndex !== -1) {
          this.syncQueue[itemIndex].retries++;
          this.syncQueue[itemIndex].lastError = error.message;
          this.syncQueue[itemIndex].lastAttempt = new Date().toISOString();

          // Si se agotaron los reintentos, mover a fallidos
          if (this.syncQueue[itemIndex].retries >= this.syncQueue[itemIndex].maxRetries) {
            failed.push(item.id);
          }
        }
      }
    }

    // Remover elementos procesados exitosamente
    this.syncQueue = this.syncQueue.filter(item => 
      !processed.includes(item.id) && !failed.includes(item.id)
    );

    // Manejar elementos fallidos
    if (failed.length > 0) {
      this.handleFailedSync(failed);
    }

    this.saveQueue();
    this.notifyListeners();
    this.isProcessing = false;

    if (processed.length > 0) {
      this.notifySync('success', `${processed.length} elementos sincronizados`);
    }
    if (failed.length > 0) {
      this.notifySync('error', `${failed.length} elementos fallaron`);
    }
  }

  // Procesar un elemento individual de la cola
  async processSyncItem(item) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...item.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(item.url, {
      method: item.method,
      headers,
      body: item.data ? JSON.stringify(item.data) : undefined,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  // Manejar elementos que fallaron múltiples veces
  handleFailedSync(failedIds) {
    const failedItems = this.syncQueue.filter(item => failedIds.includes(item.id));
    
    // Guardar elementos fallidos para revisión manual
    const existingFailed = JSON.parse(localStorage.getItem('crm-failed-sync') || '[]');
    const newFailed = failedItems.map(item => ({
      ...item,
      failedAt: new Date().toISOString(),
      reason: item.lastError || 'Unknown error'
    }));
    
    localStorage.setItem('crm-failed-sync', JSON.stringify([...existingFailed, ...newFailed]));
    
    console.warn('[OfflineSync] Items moved to failed queue:', failedIds);
  }

  // Obtener estadísticas de sincronización
  getStats() {
    const failed = JSON.parse(localStorage.getItem('crm-failed-sync') || '[]');
    const cacheHits = parseInt(localStorage.getItem('cache-hits') || '0');
    const cacheMisses = parseInt(localStorage.getItem('cache-misses') || '0');

    return {
      queueSize: this.syncQueue.length,
      failedCount: failed.length,
      isProcessing: this.isProcessing,
      isOnline: navigator.onLine,
      cacheHitRate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0,
      lastProcessed: localStorage.getItem('last-sync-processed') || null
    };
  }

  // Limpiar elementos fallidos
  clearFailedItems() {
    localStorage.removeItem('crm-failed-sync');
    this.notifyListeners();
  }

  // Reintentar elementos fallidos
  retryFailedItems() {
    const failed = JSON.parse(localStorage.getItem('crm-failed-sync') || '[]');
    
    // Reiniciar contadores y volver a la cola principal
    const retryItems = failed.map(item => ({
      ...item,
      retries: 0,
      lastError: null,
      lastAttempt: null
    }));

    this.syncQueue.push(...retryItems);
    this.clearFailedItems();
    this.saveQueue();
    this.notifyListeners();

    if (navigator.onLine) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  // Agregar listener para cambios en la cola
  addListener(callback) {
    this.listeners.push(callback);
  }

  // Remover listener
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  // Notificar a listeners sobre cambios
  notifyListeners() {
    const stats = this.getStats();
    this.listeners.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  // Notificar sobre resultado de sincronización
  notifySync(type, message) {
    const event = new CustomEvent('syncNotification', {
      detail: { type, message, timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(event);

    if (type === 'success') {
      localStorage.setItem('last-sync-processed', new Date().toISOString());
    }
  }

  // Métodos específicos para diferentes tipos de datos

  // Sincronizar nueva reserva
  syncReservation(reservationData) {
    return this.addToQueue({
      type: 'reservation',
      url: '/api/reservations',
      method: 'POST',
      data: reservationData,
      description: `Nueva reserva: ${reservationData.cliente}`
    });
  }

  // Sincronizar actualización de habitación
  syncRoomUpdate(roomId, roomData) {
    return this.addToQueue({
      type: 'room-update',
      url: `/api/rooms/${roomId}`,
      method: 'PUT',
      data: roomData,
      description: `Actualizar habitación: ${roomId}`
    });
  }

  // Sincronizar check-in
  syncCheckIn(reservationId, checkInData) {
    return this.addToQueue({
      type: 'checkin',
      url: `/api/reservations/${reservationId}/checkin`,
      method: 'POST',
      data: checkInData,
      description: `Check-in: ${reservationId}`
    });
  }

  // Sincronizar check-out
  syncCheckOut(reservationId, checkOutData) {
    return this.addToQueue({
      type: 'checkout',
      url: `/api/reservations/${reservationId}/checkout`,
      method: 'POST',
      data: checkOutData,
      description: `Check-out: ${reservationId}`
    });
  }

  // Sincronizar actualización de cliente
  syncClientUpdate(clientId, clientData) {
    return this.addToQueue({
      type: 'client-update',
      url: `/api/clients/${clientId}`,
      method: 'PUT',
      data: clientData,
      description: `Actualizar cliente: ${clientData.nombre || clientId}`
    });
  }

  // Forzar sincronización inmediata
  forcSync() {
    if (navigator.onLine) {
      return this.processQueue();
    } else {
      throw new Error('No hay conexión a internet');
    }
  }

  // Limpiar toda la información de sincronización
  clearAll() {
    this.syncQueue = [];
    localStorage.removeItem('crm-sync-queue');
    localStorage.removeItem('crm-failed-sync');
    localStorage.removeItem('last-sync-processed');
    this.notifyListeners();
  }
}

// Instancia singleton
const offlineSyncService = new OfflineSyncService();

export default offlineSyncService;