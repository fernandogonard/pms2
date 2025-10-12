// Componente de gestión de notificaciones para CRM Hotelero
import React, { useState, useEffect } from 'react';
import notificationService from '../services/notificationService';

const NotificationManager = () => {
  const [permission, setPermission] = useState(notificationService.permission);
  const [activeNotifications, setActiveNotifications] = useState([]);
  const [stats, setStats] = useState(notificationService.getStats());
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    // Suscribirse a cambios de notificaciones
    const handleNotificationEvent = (event, data) => {
      if (event === 'permission') {
        setPermission(data.granted ? 'granted' : 'denied');
      }
      setStats(notificationService.getStats());
    };

    notificationService.subscribe(handleNotificationEvent);

    // Cargar notificaciones activas
    loadActiveNotifications();

    // Actualizar cada 30 segundos
    const interval = setInterval(loadActiveNotifications, 30000);

    return () => {
      notificationService.unsubscribe(handleNotificationEvent);
      clearInterval(interval);
    };
  }, []);

  const loadActiveNotifications = async () => {
    try {
      const notifications = await notificationService.getActiveNotifications();
      setActiveNotifications(notifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const granted = await notificationService.requestPermission();
      setPermission(granted ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting permission:', error);
    }
  };

  const handleTestNotifications = () => {
    notificationService.testNotifications();
  };

  const handleCloseAll = async () => {
    await notificationService.closeAllNotifications();
    setActiveNotifications([]);
  };

  const handleScheduleDaily = () => {
    notificationService.scheduleDailyReminders();
    alert('Recordatorios diarios programados exitosamente');
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return { text: 'Concedido', icon: '✅', class: 'text-success' };
      case 'denied':
        return { text: 'Denegado', icon: '❌', class: 'text-danger' };
      default:
        return { text: 'Pendiente', icon: '⏳', class: 'text-warning' };
    }
  };

  const permissionStatus = getPermissionStatus();

  return (
    <div className="notification-manager">
      {/* Botón de toggle */}
      <button
        className={`btn btn-outline-info btn-sm position-relative ${showPanel ? 'active' : ''}`}
        onClick={() => setShowPanel(!showPanel)}
        title="Gestión de Notificaciones"
      >
        🔔
        {activeNotifications.length > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
            {activeNotifications.length}
          </span>
        )}
      </button>

      {/* Panel de gestión */}
      {showPanel && (
        <div className="card position-absolute" 
             style={{ 
               top: '100%', 
               right: 0, 
               minWidth: '350px', 
               zIndex: 1050,
               marginTop: '5px'
             }}>
          <div className="card-header bg-info text-white d-flex align-items-center justify-content-between">
            <h6 className="mb-0">🔔 Notificaciones</h6>
            <button
              className="btn btn-sm btn-outline-light"
              onClick={() => setShowPanel(false)}
            >
              ✕
            </button>
          </div>
          
          <div className="card-body">
            {/* Estado de permisos */}
            <div className="mb-3">
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-medium">Estado:</span>
                <span className={`d-flex align-items-center ${permissionStatus.class}`}>
                  {permissionStatus.icon} {permissionStatus.text}
                </span>
              </div>
              
              {permission !== 'granted' && (
                <button
                  className="btn btn-primary btn-sm mt-2 w-100"
                  onClick={handleRequestPermission}
                >
                  🔔 Solicitar Permisos
                </button>
              )}
            </div>

            {/* Estadísticas */}
            <div className="mb-3">
              <small className="text-muted d-block">Estadísticas:</small>
              <div className="row g-2 mt-1">
                <div className="col-6">
                  <div className="text-center">
                    <div className="fw-bold text-primary">{activeNotifications.length}</div>
                    <small className="text-muted">Activas</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="text-center">
                    <div className="fw-bold text-info">{stats.subscriberCount}</div>
                    <small className="text-muted">Listeners</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Notificaciones activas */}
            {activeNotifications.length > 0 && (
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <small className="text-muted">Notificaciones Activas:</small>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={handleCloseAll}
                  >
                    Cerrar Todas
                  </button>
                </div>
                
                <div className="list-group list-group-flush" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {activeNotifications.slice(0, 5).map((notification, index) => (
                    <div key={index} className="list-group-item p-2">
                      <div className="fw-medium text-truncate" style={{ fontSize: '0.875rem' }}>
                        {notification.title}
                      </div>
                      <div className="text-muted text-truncate" style={{ fontSize: '0.75rem' }}>
                        {notification.body}
                      </div>
                      {notification.timestamp && (
                        <small className="text-muted">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </small>
                      )}
                    </div>
                  ))}
                  {activeNotifications.length > 5 && (
                    <div className="list-group-item p-2 text-center text-muted">
                      <small>... y {activeNotifications.length - 5} más</small>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Acciones rápidas */}
            <div className="d-grid gap-2">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={handleTestNotifications}
                disabled={permission !== 'granted'}
              >
                🧪 Probar Notificaciones
              </button>
              
              <button
                className="btn btn-outline-success btn-sm"
                onClick={handleScheduleDaily}
                disabled={permission !== 'granted'}
              >
                ⏰ Programar Recordatorios
              </button>
            </div>

            {/* Información adicional */}
            <div className="mt-3 pt-2 border-top">
              <small className="text-muted">
                <div className="d-flex align-items-center justify-content-between">
                  <span>Soporte:</span>
                  <span className={stats.isSupported ? 'text-success' : 'text-danger'}>
                    {stats.isSupported ? '✅ Sí' : '❌ No'}
                  </span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span>Service Worker:</span>
                  <span className={stats.hasServiceWorker ? 'text-success' : 'text-warning'}>
                    {stats.hasServiceWorker ? '✅ Activo' : '⏳ Cargando'}
                  </span>
                </div>
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para mostrar notificaciones tipo toast
export const NotificationToast = ({ notification, onClose }) => {
  useEffect(() => {
    // Auto-close después de 5 segundos
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'reservation': return '📅';
      case 'checkin': return '⏰';
      case 'checkout': return '🚪';
      case 'cleaning': return '🧹';
      case 'maintenance': return '🔧';
      case 'occupancy': return '📈';
      case 'technical': return '⚠️';
      default: return '🔔';
    }
  };

  return (
    <div className="toast show position-fixed bottom-0 end-0 m-3" 
         style={{ zIndex: 9999, minWidth: '300px' }}>
      <div className="toast-header">
        <span className="me-2">{getTypeIcon(notification.data?.type)}</span>
        <strong className="me-auto">{notification.title}</strong>
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
        ></button>
      </div>
      <div className="toast-body">
        {notification.body}
        {notification.data?.action && (
          <div className="mt-2">
            <button className="btn btn-primary btn-sm me-2">
              Ver Detalles
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Hook para usar notificaciones en componentes
export const useNotifications = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (notification) => {
    const id = Date.now();
    setToasts(prev => [...prev, { ...notification, id }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showNotification = (title, options = {}) => {
    const success = notificationService.showNotification(title, options);
    
    // También mostrar como toast si las notificaciones nativas fallan
    if (!success) {
      addToast({ title, body: options.body, data: options.data });
    }
    
    return success;
  };

  // Métodos específicos
  const notifyNewReservation = (data) => {
    return notificationService.notifyNewReservation(data);
  };

  const notifyCheckInReminder = (data) => {
    return notificationService.notifyCheckInReminder(data);
  };

  const notifyCheckOutReminder = (data) => {
    return notificationService.notifyCheckOutReminder(data);
  };

  const notifyRoomCleaning = (data) => {
    return notificationService.notifyRoomCleaning(data);
  };

  const notifyHighOccupancy = (data) => {
    return notificationService.notifyHighOccupancy(data);
  };

  const notifyTechnicalIssue = (data) => {
    return notificationService.notifyTechnicalIssue(data);
  };

  return {
    toasts,
    removeToast,
    showNotification,
    notifyNewReservation,
    notifyCheckInReminder,
    notifyCheckOutReminder,
    notifyRoomCleaning,
    notifyHighOccupancy,
    notifyTechnicalIssue,
    permission: notificationService.permission,
    requestPermission: notificationService.requestPermission.bind(notificationService)
  };
};

export default NotificationManager;