// components/LazyComponents.js
// Componentes con lazy loading y code splitting optimizado

import React, { Suspense, lazy } from 'react';

// Loading component optimizado
const OptimizedLoader = ({ size = 'lg', message = 'Cargando...' }) => (
  <div className="d-flex flex-column justify-content-center align-items-center" 
       style={{ minHeight: size === 'sm' ? '100px' : '300px' }}>
    <div className={`spinner-border text-primary ${size === 'sm' ? 'spinner-border-sm' : ''}`} 
         role="status">
      <span className="visually-hidden">{message}</span>
    </div>
    <p className="mt-2 text-muted">{message}</p>
  </div>
);

// Error boundary para lazy components
class LazyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-danger text-center">
          <h5>Error al cargar componente</h5>
          <p>Por favor, recarga la página</p>
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC para componentes lazy con preloading
const withLazyLoading = (importFunc, loaderProps = {}) => {
  const LazyComponent = lazy(importFunc);
  
  return React.forwardRef((props, ref) => (
    <LazyErrorBoundary>
      <Suspense fallback={<OptimizedLoader {...loaderProps} />}>
        <LazyComponent {...props} ref={ref} />
      </Suspense>
    </LazyErrorBoundary>
  ));
};

// Lazy components optimizados
export const LazyAdminDashboard = withLazyLoading(
  () => import('../pages/AdminDashboard'),
  { message: 'Cargando Panel Administrativo...' }
);

export const LazyReceptionDashboard = withLazyLoading(
  () => import('../pages/ReceptionDashboard'),
  { message: 'Cargando Panel de Recepción...' }
);

export const LazyRoomCalendar = withLazyLoading(
  () => import('../components/RoomCalendar'),
  { message: 'Cargando Calendario...', size: 'sm' }
);

export const LazyReservationTable = withLazyLoading(
  () => import('../components/ReservationTable'),
  { message: 'Cargando Reservas...', size: 'sm' }
);

export const LazyRoomTable = withLazyLoading(
  () => import('../components/RoomTable'),
  { message: 'Cargando Habitaciones...', size: 'sm' }
);

export const LazyUserTable = withLazyLoading(
  () => import('../components/UserTable'),
  { message: 'Cargando Usuarios...', size: 'sm' }
);

export const LazyClientTable = withLazyLoading(
  () => import('../components/ClientTable'),
  { message: 'Cargando Clientes...', size: 'sm' }
);

export const LazyAdvancedReservationModal = withLazyLoading(
  () => import('../components/AdvancedReservationModal'),
  { message: 'Cargando Modal...', size: 'sm' }
);

export const LazyReportDownload = withLazyLoading(
  () => import('../components/ReportDownload'),
  { message: 'Cargando Reportes...', size: 'sm' }
);

// Hook para precargar componentes
export const usePreloadComponent = (importFunc) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      importFunc();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [importFunc]);
};

// Hook para lazy loading con intersección
export const useLazyIntersection = (ref, importFunc, threshold = 0.1) => {
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          importFunc();
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [ref, importFunc, threshold]);
};

export default {
  LazyAdminDashboard,
  LazyReceptionDashboard,
  LazyRoomCalendar,
  LazyReservationTable,
  LazyRoomTable,
  LazyUserTable,
  LazyClientTable,
  LazyAdvancedReservationModal,
  LazyReportDownload,
  OptimizedLoader,
  LazyErrorBoundary,
  withLazyLoading,
  usePreloadComponent,
  useLazyIntersection
};