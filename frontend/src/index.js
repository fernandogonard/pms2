// index.js
// Punto de entrada de la aplicación React
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initMonitoring } from './utils/monitoring';
import './theme-2026.css';
// Inicializar monitoreo global (error handlers, Sentry si REACT_APP_SENTRY_DSN está configurado)
initMonitoring();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Desactivar el registro del Service Worker en desarrollo
// Si necesitas PWA en producción, vuelve a activar este bloque
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js').then(registration => {
//       console.log('SW registrado:', registration);
//     }).catch(error => {
//       console.log('SW registro fallido:', error);
//     });
//   });
// }
