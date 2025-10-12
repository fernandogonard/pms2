// Hook personalizado para funcionalidad offline en CRM Hotelero
// Maneja sincronización, cache local y estado de conectividad

import { useState, useEffect, useRef, useCallback } from 'react';

// Hook principal para funcionalidad offline
export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const addToQueue = useCallback((action) => {
    setSyncQueue(prev => [...prev, { 
      ...action, 
      id: Date.now(),
      timestamp: new Date().toISOString()
    }]);
  }, []);
  
  const processQueue = useCallback(async () => {
    if (syncQueue.length === 0) return;
    
    const processed = [];
    
    for (const action of syncQueue) {
      try {
        await action.execute();
        processed.push(action.id);
      } catch (error) {
        console.error('Error processing queued action:', error);
      }
    }
    
    setSyncQueue(prev => prev.filter(item => !processed.includes(item.id)));
    setLastSync(new Date().toISOString());
  }, [syncQueue]);
  
  return {
    isOnline,
    syncQueue,
    lastSync,
    addToQueue,
    processQueue
  };
};

// Hook para cache local de datos
export const useLocalCache = (key, defaultValue = null) => {
  const [data, setData] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadFromCache();
  }, [key]);
  
  const loadFromCache = async () => {
    try {
      setIsLoading(true);
      const cached = localStorage.getItem(`crm-cache-${key}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.expiry > Date.now()) {
          setData(parsed.data);
        } else {
          localStorage.removeItem(`crm-cache-${key}`);
        }
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveToCache = (newData, expiryMinutes = 60) => {
    try {
      const cacheData = {
        data: newData,
        expiry: Date.now() + (expiryMinutes * 60 * 1000),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(`crm-cache-${key}`, JSON.stringify(cacheData));
      setData(newData);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };
  
  const clearCache = () => {
    localStorage.removeItem(`crm-cache-${key}`);
    setData(defaultValue);
  };
  
  return {
    data,
    isLoading,
    saveToCache,
    clearCache,
    loadFromCache
  };
};

// Hook para requests con funcionalidad offline
export const useOfflineRequest = () => {
  const { isOnline, addToQueue } = useOffline();
  
  const makeRequest = useCallback(async (url, options = {}) => {
    const requestId = `request-${Date.now()}`;
    
    try {
      // Si estamos online, hacer request normal
      if (isOnline) {
        const response = await fetch(url, options);
        
        // Cachear respuestas exitosas de GET
        if (response.ok && options.method !== 'POST') {
          const responseData = await response.clone().json();
          const cacheKey = `api-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
          localStorage.setItem(
            `crm-cache-${cacheKey}`,
            JSON.stringify({
              data: responseData,
              expiry: Date.now() + (5 * 60 * 1000), // 5 minutos
              timestamp: new Date().toISOString()
            })
          );
        }
        
        return response;
      }
      
      // Si estamos offline
      if (options.method === 'GET') {
        // Intentar servir desde cache para GET requests
        const cacheKey = `api-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const cached = localStorage.getItem(`crm-cache-${cacheKey}`);
        
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.expiry > Date.now()) {
            return new Response(JSON.stringify(parsed.data), {
              status: 200,
              headers: { 
                'Content-Type': 'application/json',
                'X-Offline-Response': 'true'
              }
            });
          }
        }
        
        throw new Error('No offline data available');
      }
      
      // Para POST/PUT/DELETE, agregar a cola de sincronización
      if (['POST', 'PUT', 'DELETE'].includes(options.method)) {
        addToQueue({
          id: requestId,
          url,
          options,
          execute: async () => {
            const response = await fetch(url, options);
            if (!response.ok) {
              throw new Error(`Request failed: ${response.status}`);
            }
            return response;
          }
        });
        
        // Retornar respuesta mock
        return new Response(JSON.stringify({
          success: true,
          offline: true,
          message: 'Acción guardada para sincronización',
          requestId
        }), {
          status: 202, // Accepted
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    } catch (error) {
      console.error('Request error:', error);
      throw error;
    }
  }, [isOnline, addToQueue]);
  
  return { makeRequest, isOnline };
};

// Hook para notificaciones PWA
export const usePWANotifications = () => {
  const [permission, setPermission] = useState(Notification.permission);
  const [isSupported, setIsSupported] = useState('Notification' in window);
  
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);
  
  const requestPermission = async () => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };
  
  const showNotification = (title, options = {}) => {
    if (permission !== 'granted') return false;
    
    const defaultOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'crm-hotelero',
      requireInteraction: false,
      ...options
    };
    
    try {
      if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
        // Usar Service Worker para notificaciones
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, defaultOptions);
        });
      } else {
        // Fallback a notificación directa
        new Notification(title, defaultOptions);
      }
      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  };
  
  const showReservationNotification = (reservationData) => {
    return showNotification('Nueva Reserva', {
      body: `${reservationData.cliente} - Habitación ${reservationData.habitacion}`,
      data: { type: 'reservation', ...reservationData },
      actions: [
        { action: 'view', title: 'Ver Detalles' },
        { action: 'dismiss', title: 'Cerrar' }
      ]
    });
  };
  
  const showCheckInReminder = (reservationData) => {
    return showNotification('Recordatorio Check-In', {
      body: `${reservationData.cliente} debe hacer check-in hoy`,
      data: { type: 'checkin', ...reservationData },
      requireInteraction: true
    });
  };
  
  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    showReservationNotification,
    showCheckInReminder
  };
};

// Hook para instalación de PWA
export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  
  useEffect(() => {
    // Detectar si la app ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://')) {
      setIsInstalled(true);
    }
    
    // Escuchar evento de instalación
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);
  
  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    
    try {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
      
      return result.outcome === 'accepted';
    } catch (error) {
      console.error('Error prompting install:', error);
      return false;
    }
  };
  
  return {
    isInstallable,
    isInstalled,
    promptInstall
  };
};

// Utilidad para generar iconos PWA
export const generatePWAIcons = async () => {
  // Esta función se puede usar para generar iconos de diferentes tamaños
  // basados en un icono base
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const baseIcon = '/favicon.ico';
  
  return sizes.map(size => ({
    src: `/icons/icon-${size}x${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: 'maskable any'
  }));
};

// Hook para métricas PWA
export const usePWAMetrics = () => {
  const [metrics, setMetrics] = useState({
    cacheHitRate: 0,
    offlineUsage: 0,
    syncQueueSize: 0,
    lastSync: null
  });
  
  useEffect(() => {
    const updateMetrics = () => {
      // Obtener métricas del cache
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('crm-cache-'));
      const cacheHits = parseInt(localStorage.getItem('cache-hits') || '0');
      const cacheMisses = parseInt(localStorage.getItem('cache-misses') || '0');
      
      setMetrics(prev => ({
        ...prev,
        cacheHitRate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0,
        cacheSize: cacheKeys.length,
        lastUpdate: new Date().toISOString()
      }));
    };
    
    updateMetrics();
    const interval = setInterval(updateMetrics, 30000); // Actualizar cada 30 segundos
    
    return () => clearInterval(interval);
  }, []);
  
  const incrementCacheHit = () => {
    const hits = parseInt(localStorage.getItem('cache-hits') || '0') + 1;
    localStorage.setItem('cache-hits', hits.toString());
  };
  
  const incrementCacheMiss = () => {
    const misses = parseInt(localStorage.getItem('cache-misses') || '0') + 1;
    localStorage.setItem('cache-misses', misses.toString());
  };
  
  return {
    metrics,
    incrementCacheHit,
    incrementCacheMiss
  };
};