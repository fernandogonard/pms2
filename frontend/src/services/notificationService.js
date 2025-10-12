// Servicio de notificaciones push para CRM Hotelero
// Maneja notificaciones locales y push notifications

class NotificationService {
  constructor() {
    this.permission = Notification.permission;
    this.isSupported = 'Notification' in window;
    this.swRegistration = null;
    this.subscribers = [];
    
    this.initializeServiceWorker();
  }

  async initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.ready;
        console.log('[Notifications] Service Worker ready');
      } catch (error) {
        console.error('[Notifications] Service Worker error:', error);
      }
    }
  }

  // Solicitar permisos de notificación
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Notifications not supported');
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('[Notifications] Permission granted');
        this.notifySubscribers('permission', { granted: true });
        return true;
      } else {
        console.log('[Notifications] Permission denied');
        this.notifySubscribers('permission', { granted: false });
        return false;
      }
    } catch (error) {
      console.error('[Notifications] Permission request error:', error);
      return false;
    }
  }

  // Mostrar notificación simple
  showNotification(title, options = {}) {
    if (this.permission !== 'granted') {
      console.warn('[Notifications] Permission not granted');
      return false;
    }

    const defaultOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'crm-hotelero',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      ...options
    };

    try {
      if (this.swRegistration && 'showNotification' in ServiceWorkerRegistration.prototype) {
        // Usar Service Worker para mejor control
        return this.swRegistration.showNotification(title, defaultOptions);
      } else {
        // Fallback a notificación directa
        const notification = new Notification(title, defaultOptions);
        
        // Auto-close después de 5 segundos si no requireInteraction
        if (!defaultOptions.requireInteraction) {
          setTimeout(() => {
            notification.close();
          }, 5000);
        }
        
        return notification;
      }
    } catch (error) {
      console.error('[Notifications] Show error:', error);
      return false;
    }
  }

  // Notificaciones específicas del CRM

  // Nueva reserva
  notifyNewReservation(reservationData) {
    return this.showNotification('Nueva Reserva 📅', {
      body: `${reservationData.cliente}\nHabitación ${reservationData.habitacion}\nFecha: ${new Date(reservationData.fechaEntrada).toLocaleDateString()}`,
      tag: 'new-reservation',
      data: { 
        type: 'reservation',
        action: 'view',
        id: reservationData.id 
      },
      actions: [
        { action: 'view', title: '👁️ Ver Detalles', icon: '/icons/action-view.png' },
        { action: 'dismiss', title: '✖️ Cerrar', icon: '/icons/action-close.png' }
      ],
      requireInteraction: true
    });
  }

  // Recordatorio de check-in
  notifyCheckInReminder(reservationData) {
    return this.showNotification('Recordatorio Check-In ⏰', {
      body: `${reservationData.cliente} debe hacer check-in hoy\nHabitación ${reservationData.habitacion}`,
      tag: 'checkin-reminder',
      data: { 
        type: 'checkin',
        action: 'checkin',
        id: reservationData.id 
      },
      actions: [
        { action: 'checkin', title: '✅ Check-In', icon: '/icons/action-checkin.png' },
        { action: 'later', title: '⏰ Más Tarde', icon: '/icons/action-later.png' }
      ],
      requireInteraction: true,
      vibrate: [300, 200, 300, 200, 300]
    });
  }

  // Recordatorio de check-out
  notifyCheckOutReminder(reservationData) {
    return this.showNotification('Recordatorio Check-Out 🚪', {
      body: `${reservationData.cliente} debe hacer check-out hoy\nHabitación ${reservationData.habitacion}`,
      tag: 'checkout-reminder',
      data: { 
        type: 'checkout',
        action: 'checkout',
        id: reservationData.id 
      },
      actions: [
        { action: 'checkout', title: '🚪 Check-Out', icon: '/icons/action-checkout.png' },
        { action: 'extend', title: '⏱️ Extender', icon: '/icons/action-extend.png' }
      ],
      requireInteraction: true
    });
  }

  // Habitación lista para limpieza
  notifyRoomCleaning(roomData) {
    return this.showNotification('Limpieza Requerida 🧹', {
      body: `Habitación ${roomData.numero} requiere limpieza\nEstado actual: ${roomData.estado}`,
      tag: 'room-cleaning',
      data: { 
        type: 'cleaning',
        action: 'clean',
        roomId: roomData.id 
      },
      actions: [
        { action: 'assign', title: '👷 Asignar', icon: '/icons/action-assign.png' },
        { action: 'later', title: '⏰ Más Tarde', icon: '/icons/action-later.png' }
      ]
    });
  }

  // Mantenimiento programado
  notifyMaintenance(maintenanceData) {
    return this.showNotification('Mantenimiento Programado 🔧', {
      body: `${maintenanceData.description}\nFecha: ${new Date(maintenanceData.scheduledDate).toLocaleDateString()}`,
      tag: 'maintenance',
      data: { 
        type: 'maintenance',
        action: 'view',
        id: maintenanceData.id 
      },
      requireInteraction: true
    });
  }

  // Ocupación alta
  notifyHighOccupancy(occupancyData) {
    return this.showNotification('Ocupación Alta 📈', {
      body: `Ocupación actual: ${occupancyData.percentage}%\nHabitaciones disponibles: ${occupancyData.available}`,
      tag: 'high-occupancy',
      data: { 
        type: 'occupancy',
        action: 'view'
      }
    });
  }

  // Problema técnico
  notifyTechnicalIssue(issueData) {
    return this.showNotification('Problema Técnico ⚠️', {
      body: `${issueData.description}\nUbicación: ${issueData.location}`,
      tag: 'technical-issue',
      data: { 
        type: 'technical',
        action: 'resolve',
        id: issueData.id 
      },
      actions: [
        { action: 'resolve', title: '🔧 Resolver', icon: '/icons/action-resolve.png' },
        { action: 'escalate', title: '⬆️ Escalar', icon: '/icons/action-escalate.png' }
      ],
      requireInteraction: true,
      vibrate: [500, 300, 500, 300, 500]
    });
  }

  // Notificaciones programadas
  scheduleNotification(title, options, delay) {
    return setTimeout(() => {
      this.showNotification(title, options);
    }, delay);
  }

  // Programar recordatorios diarios
  scheduleDailyReminders() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM

    const msUntilTomorrow = tomorrow.getTime() - now.getTime();

    // Recordatorio diario de check-ins
    this.scheduleNotification('Recordatorio Diario 📋', {
      body: 'Revisar check-ins programados para hoy',
      tag: 'daily-checkins',
      data: { type: 'daily', action: 'checkins' }
    }, msUntilTomorrow);

    // Programar para los próximos días también
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(tomorrow);
      futureDate.setDate(futureDate.getDate() + i);
      const msUntilFuture = futureDate.getTime() - now.getTime();

      this.scheduleNotification('Recordatorio Diario 📋', {
        body: 'Revisar actividades programadas para hoy',
        tag: `daily-reminder-${i}`,
        data: { type: 'daily', action: 'review' }
      }, msUntilFuture);
    }
  }

  // Obtener notificaciones activas
  async getActiveNotifications() {
    if (!this.swRegistration) return [];

    try {
      const notifications = await this.swRegistration.getNotifications();
      return notifications.map(notification => ({
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        data: notification.data,
        timestamp: notification.timestamp
      }));
    } catch (error) {
      console.error('[Notifications] Get active error:', error);
      return [];
    }
  }

  // Cerrar notificaciones por tag
  async closeNotificationsByTag(tag) {
    if (!this.swRegistration) return;

    try {
      const notifications = await this.swRegistration.getNotifications({ tag });
      notifications.forEach(notification => notification.close());
    } catch (error) {
      console.error('[Notifications] Close by tag error:', error);
    }
  }

  // Cerrar todas las notificaciones
  async closeAllNotifications() {
    if (!this.swRegistration) return;

    try {
      const notifications = await this.swRegistration.getNotifications();
      notifications.forEach(notification => notification.close());
    } catch (error) {
      console.error('[Notifications] Close all error:', error);
    }
  }

  // Test de notificaciones
  testNotifications() {
    const tests = [
      () => this.showNotification('Test Básico ✅', {
        body: 'Esta es una notificación de prueba básica'
      }),
      
      () => this.notifyNewReservation({
        id: 'test-123',
        cliente: 'Juan Pérez',
        habitacion: '101',
        fechaEntrada: new Date()
      }),
      
      () => this.notifyCheckInReminder({
        id: 'test-456',
        cliente: 'María García',
        habitacion: '202'
      }),
      
      () => this.notifyHighOccupancy({
        percentage: 95,
        available: 2
      })
    ];

    // Ejecutar tests con intervalos
    tests.forEach((test, index) => {
      setTimeout(test, index * 2000);
    });
  }

  // Suscribirse a eventos de notificación
  subscribe(callback) {
    this.subscribers.push(callback);
  }

  // Desuscribirse de eventos
  unsubscribe(callback) {
    this.subscribers = this.subscribers.filter(sub => sub !== callback);
  }

  // Notificar a suscriptores
  notifySubscribers(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('[Notifications] Subscriber error:', error);
      }
    });
  }

  // Obtener estadísticas
  getStats() {
    return {
      permission: this.permission,
      isSupported: this.isSupported,
      hasServiceWorker: !!this.swRegistration,
      subscriberCount: this.subscribers.length
    };
  }
}

// Instancia singleton
const notificationService = new NotificationService();

export default notificationService;