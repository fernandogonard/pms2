// App.js
// Componente raíz de la aplicación React para el CRM hotelero con PWA
import React from 'react';
import AppRouter from './AppRouter';
import PWAStatus, { OfflineBanner, InstallPrompt } from './components/PWAStatus';
import { useOffline } from './hooks/useOffline';

function App() {
  const { isOnline } = useOffline();

  return (
    <div className="app">
      {/* Banner offline si no hay conexión */}
      <OfflineBanner />
      
      {/* Router principal */}
      <AppRouter />
      
      {/* Prompt de instalación */}
      <InstallPrompt />
      
      {/* Estado PWA (solo mostrar en desarrollo o si el usuario lo solicita) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="position-fixed bottom-0 start-0 m-2" style={{ zIndex: 1000 }}>
          <PWAStatus />
        </div>
      )}
    </div>
  );
}

export default App;
