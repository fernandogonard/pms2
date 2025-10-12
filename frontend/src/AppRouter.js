// AppRouter.js
// Enrutador principal para el CRM hotelero con autenticación real
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminDashboard from './pages/AdminDashboard';
import ReceptionDashboard from './pages/ReceptionDashboard';
import Login from './pages/Login';
import PublicHome from './pages/PublicHome';
import HotelInfo from './pages/HotelInfo';
import ReservationManagerDemo from './components/ReservationManagerDemo';
import SessionExpiredBanner from './components/SessionExpiredBanner';

// Componente de carga
const LoadingSpinner = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Cargando...</span>
    </div>
  </div>
);

// Componente para rutas privadas con autenticación real
const PrivateRoute = ({ children, role }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (role && user?.role !== role) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
};

// Componente simple para 404
const NotFound = () => (
  <div style={{ textAlign: 'center', marginTop: 80 }}>
    <h1 style={{ fontSize: 56, margin: 0 }}>404</h1>
    <p style={{ fontSize: 18 }}>Página no encontrada</p>
  </div>
);

// Página simple para usuarios sin permisos
const Unauthorized = () => (
  <div style={{ textAlign: 'center', marginTop: 80 }}>
    <h1 style={{ fontSize: 40, margin: 0 }}>Acceso denegado</h1>
    <p style={{ fontSize: 18 }}>No tienes permisos para ver esta página.</p>
  </div>
);

// Componente interno del router (requiere estar dentro del AuthProvider)
const AppRouterContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [nextPath, setNextPath] = useState('/');

  useEffect(() => {
    const handler = (e) => {
      setNextPath((e && e.detail && e.detail.next) ? e.detail.next : '/');
      setSessionExpired(true);
    };
    window.addEventListener('sessionExpired', handler);
    return () => window.removeEventListener('sessionExpired', handler);
  }, []);

  const handleRedirect = () => {
    setSessionExpired(false);
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      {sessionExpired && (
        <SessionExpiredBanner next={nextPath} onRedirect={handleRedirect} />
      )}
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/hotel-info" element={<HotelInfo />} />
        <Route path="/login" element={<Login />} />
        <Route path="/demo-reservas" element={<ReservationManagerDemo />} />
        <Route path="/admin" element={
          <PrivateRoute role="admin">
            <AdminDashboard />
          </PrivateRoute>
        } />
        <Route path="/recepcion" element={
          <PrivateRoute role="recepcionista">
            <ReceptionDashboard />
          </PrivateRoute>
        } />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

// Componente principal del router con AuthProvider
const AppRouter = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRouterContent />
      </Router>
    </AuthProvider>
  );
};

export default AppRouter;
