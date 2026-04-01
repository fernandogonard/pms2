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

  // Detectar iOS (Safari no soporta beforeinstallprompt)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone;

  // Dismissed con expiracín de 3 días
  const getDismissed = () => {    // Limpiar flag viejo (sin expiración) si existe
    localStorage.removeItem('install-prompt-dismissed');    const ts = localStorage.getItem('install-prompt-ts');
    if (!ts) return false;
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    return Date.now() - parseInt(ts, 10) < THREE_DAYS;
  };
  const [dismissed, setDismissed] = React.useState(getDismissed);

  // Si ya está instalada como PWA, no mostrar nada
  if (isInStandaloneMode) return null;

  // iOS: mostrar instrucciones manuales si no fue descartado
  if (isIOS && !dismissed) {
    return (
      <div style={{
        position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9999,
        background: 'linear-gradient(135deg, #1a2744 0%, #0d1b2a 100%)',
        border: '1px solid #2563eb', borderRadius: 16, padding: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 32, flexShrink: 0 }}>📲</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Instalar en iPhone / iPad</div>
            <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
              Toca <strong style={{ color: '#fff' }}>Compartir</strong> <span style={{ fontSize: 14 }}>⬆️</span> en Safari
              {' '}y luego <strong style={{ color: '#fff' }}>&ldquo;Añadir a inicio&rdquo;</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                1️⃣ Safari → <strong style={{ color: '#fff' }}>&#x2B06; Compartir</strong>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                2️⃣ <strong style={{ color: '#fff' }}>Añadir a inicio</strong>
              </div>
            </div>
          </div>
          <button onClick={() => { localStorage.setItem('install-prompt-ts', Date.now().toString()); setDismissed(true); }}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
        </div>
      </div>
    );
  }

  // Android/Chrome: usar beforeinstallprompt
  if (!isInstallable || dismissed) return null;

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (!installed) {
      localStorage.setItem('install-prompt-ts', Date.now().toString());
      setDismissed(true);
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      background: 'linear-gradient(135deg, #1a2744 0%, #0d1b2a 100%)',
      border: '1px solid #2563eb', borderRadius: 16, padding: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: 300
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>📲</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Instalar Hotel DIVA</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>Acceso rápido desde la pantalla de inicio</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleInstall}
              style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Instalar
            </button>
            <button onClick={() => { localStorage.setItem('install-prompt-ts', Date.now().toString()); setDismissed(true); }}
              style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
              Después
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAStatus;