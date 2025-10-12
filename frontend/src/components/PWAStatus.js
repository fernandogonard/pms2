// Componente PWA Status - Muestra estado de conectividad e instalación
import React, { useState } from 'react';
import { 
  useOffline, 
  usePWAInstall, 
  usePWANotifications,
  usePWAMetrics 
} from '../hooks/useOffline';

const PWAStatus = () => {
  const { isOnline, syncQueue, lastSync, processQueue } = useOffline();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const { permission, requestPermission, showNotification } = usePWANotifications();
  const { metrics } = usePWAMetrics();
  const [showDetails, setShowDetails] = useState(false);

  const getConnectionStatus = () => {
    if (isOnline) {
      return {
        text: 'Online',
        icon: '🌐',
        class: 'text-success'
      };
    }
    return {
      text: 'Offline',
      icon: '📱',
      class: 'text-warning'
    };
  };

  const getInstallStatus = () => {
    if (isInstalled) {
      return {
        text: 'Instalada',
        icon: '✅',
        class: 'text-success'
      };
    }
    if (isInstallable) {
      return {
        text: 'Instalar',
        icon: '⬇️',
        class: 'text-primary',
        action: promptInstall
      };
    }
    return {
      text: 'Navegador',
      icon: '🌍',
      class: 'text-muted'
    };
  };

  const getNotificationStatus = () => {
    switch (permission) {
      case 'granted':
        return {
          text: 'Activas',
          icon: '🔔',
          class: 'text-success'
        };
      case 'denied':
        return {
          text: 'Bloqueadas',
          icon: '🔕',
          class: 'text-danger'
        };
      default:
        return {
          text: 'Solicitar',
          icon: '🔔',
          class: 'text-secondary',
          action: requestPermission
        };
    }
  };

  const handleTestNotification = () => {
    showNotification('Test CRM Hotelero', {
      body: 'Las notificaciones funcionan correctamente',
      icon: '/icons/icon-192x192.png'
    });
  };

  const connectionStatus = getConnectionStatus();
  const installStatus = getInstallStatus();
  const notificationStatus = getNotificationStatus();

  return (
    <div className="pwa-status">
      {/* Barra de estado compacta */}
      <div className="d-flex align-items-center gap-3 mb-2">
        {/* Estado de conexión */}
        <div className={`d-flex align-items-center ${connectionStatus.class}`}>
          <span className="me-1">{connectionStatus.icon}</span>
          <small className="fw-medium">{connectionStatus.text}</small>
        </div>

        {/* Cola de sincronización */}
        {syncQueue.length > 0 && (
          <div className="d-flex align-items-center text-warning">
            <span className="me-1">⏳</span>
            <small>
              {syncQueue.length} pendiente{syncQueue.length !== 1 ? 's' : ''}
            </small>
            {isOnline && (
              <button 
                className="btn btn-sm btn-outline-warning ms-1 py-0 px-1"
                onClick={processQueue}
                title="Sincronizar ahora"
              >
                ↻
              </button>
            )}
          </div>
        )}

        {/* Botón de instalación */}
        {installStatus.action && (
          <button
            className={`btn btn-sm btn-outline-primary py-0 px-2`}
            onClick={installStatus.action}
            title="Instalar aplicación"
          >
            {installStatus.icon} {installStatus.text}
          </button>
        )}

        {/* Estado de notificaciones */}
        {notificationStatus.action && (
          <button
            className={`btn btn-sm btn-outline-secondary py-0 px-2`}
            onClick={notificationStatus.action}
            title="Activar notificaciones"
          >
            {notificationStatus.icon}
          </button>
        )}

        {/* Toggle detalles */}
        <button
          className="btn btn-sm btn-outline-info py-0 px-2"
          onClick={() => setShowDetails(!showDetails)}
          title="Ver detalles PWA"
        >
          ℹ️
        </button>
      </div>

      {/* Panel de detalles expandible */}
      {showDetails && (
        <div className="card border-info">
          <div className="card-header bg-info text-white py-2">
            <h6 className="mb-0 d-flex align-items-center">
              📱 Estado de la PWA
              <button
                className="btn btn-sm btn-outline-light ms-auto py-0 px-2"
                onClick={() => setShowDetails(false)}
              >
                ✕
              </button>
            </h6>
          </div>
          <div className="card-body py-2">
            <div className="row g-2">
              {/* Conexión */}
              <div className="col-md-3">
                <div className="d-flex align-items-center">
                  <span className="me-2">{connectionStatus.icon}</span>
                  <div>
                    <div className={`fw-medium ${connectionStatus.class}`}>
                      {connectionStatus.text}
                    </div>
                    <small className="text-muted">Conectividad</small>
                  </div>
                </div>
              </div>

              {/* Instalación */}
              <div className="col-md-3">
                <div className="d-flex align-items-center">
                  <span className="me-2">{installStatus.icon}</span>
                  <div>
                    <div className={`fw-medium ${installStatus.class}`}>
                      {installStatus.text}
                    </div>
                    <small className="text-muted">Estado App</small>
                  </div>
                </div>
              </div>

              {/* Notificaciones */}
              <div className="col-md-3">
                <div className="d-flex align-items-center">
                  <span className="me-2">{notificationStatus.icon}</span>
                  <div>
                    <div className={`fw-medium ${notificationStatus.class}`}>
                      {notificationStatus.text}
                    </div>
                    <small className="text-muted">Notificaciones</small>
                  </div>
                </div>
              </div>

              {/* Cache */}
              <div className="col-md-3">
                <div className="d-flex align-items-center">
                  <span className="me-2">💾</span>
                  <div>
                    <div className="fw-medium text-info">
                      {metrics.cacheHitRate?.toFixed(1)}%
                    </div>
                    <small className="text-muted">Cache Hit</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Información adicional */}
            <hr className="my-2" />
            <div className="row g-2">
              <div className="col-md-6">
                <small className="text-muted">
                  <strong>Cola de sync:</strong> {syncQueue.length} acciones
                </small>
              </div>
              <div className="col-md-6">
                <small className="text-muted">
                  <strong>Última sync:</strong> {
                    lastSync 
                      ? new Date(lastSync).toLocaleTimeString()
                      : 'Nunca'
                  }
                </small>
              </div>
            </div>

            {/* Acciones de prueba */}
            <div className="mt-2">
              <div className="btn-group btn-group-sm" role="group">
                <button
                  className="btn btn-outline-secondary"
                  onClick={handleTestNotification}
                  disabled={permission !== 'granted'}
                  title="Probar notificación"
                >
                  🔔 Test
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={processQueue}
                  disabled={!isOnline || syncQueue.length === 0}
                  title="Forzar sincronización"
                >
                  ↻ Sync
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => window.location.reload()}
                  title="Recargar aplicación"
                >
                  🔄 Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner de actualización disponible */}
      <div id="pwa-update-banner"></div>
    </div>
  );
};

// Componente para mostrar cuando la app está offline
export const OfflineBanner = () => {
  const { isOnline, syncQueue } = useOffline();

  if (isOnline) return null;

  return (
    <div className="alert alert-warning alert-dismissible position-fixed top-0 start-50 translate-middle-x mt-2" 
         style={{ zIndex: 9999, minWidth: '300px' }}>
      <div className="d-flex align-items-center">
        <span className="me-2">📱</span>
        <div className="flex-grow-1">
          <strong>Modo Offline</strong>
          <br />
          <small>
            Funcionalidad limitada. 
            {syncQueue.length > 0 && ` ${syncQueue.length} acciones pendientes.`}
          </small>
        </div>
      </div>
    </div>
  );
};

// Componente para el botón de instalación flotante
export const InstallPrompt = () => {
  const { isInstallable, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(
    localStorage.getItem('install-prompt-dismissed') === 'true'
  );

  if (!isInstallable || dismissed) return null;

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (!installed) {
      // Si el usuario rechaza, no volver a mostrar por un tiempo
      localStorage.setItem('install-prompt-dismissed', 'true');
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('install-prompt-dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div className="position-fixed bottom-0 end-0 m-3" style={{ zIndex: 9999 }}>
      <div className="card shadow-lg border-primary" style={{ maxWidth: '300px' }}>
        <div className="card-body p-3">
          <div className="d-flex align-items-start">
            <span className="me-2 fs-4">📱</span>
            <div className="flex-grow-1">
              <h6 className="card-title mb-1">Instalar CRM Hotelero</h6>
              <p className="card-text small text-muted mb-2">
                Accede más rápido con la aplicación instalada
              </p>
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={handleInstall}
                >
                  Instalar
                </button>
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleDismiss}
                >
                  Después
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAStatus;