// components/ErrorBoundary.js
// Error Boundary enterprise con telemetría y recuperación

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
  }

  componentDidCatch(error, errorInfo) {
    const errorData = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      props: this.props.fallbackProps || {}
    };

    this.setState({
      error: errorData.error,
      errorInfo: errorData.errorInfo
    });

    // Enviar telemetría de error
    this.sendErrorTelemetry(errorData);

    // Log local para desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Props:', this.props);
      console.groupEnd();
    }
  }

  sendErrorTelemetry = async (errorData) => {
    try {
      // En producción, enviar a servicio de telemetría
      if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_ERROR_ENDPOINT) {
        await fetch(process.env.REACT_APP_ERROR_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'frontend_error',
            ...errorData,
            errorId: this.state.errorId
          })
        });
      }
    } catch (telemetryError) {
      console.error('Failed to send error telemetry:', telemetryError);
    }
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Fallback personalizado si se proporciona
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // UI de error por defecto
      const { level = 'component', showDetails = false } = this.props;

      if (level === 'app') {
        return (
          <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
            <div className="container">
              <div className="row justify-content-center">
                <div className="col-md-6">
                  <div className="text-center">
                    <div className="display-1 text-danger mb-4">⚠️</div>
                    <h1 className="h3 mb-3">¡Oops! Algo salió mal</h1>
                    <p className="text-muted mb-4">
                      La aplicación encontró un error inesperado. Nuestro equipo ha sido notificado.
                    </p>
                    
                    <div className="d-grid gap-2 d-md-block">
                      {this.state.retryCount < 3 && (
                        <button 
                          className="btn btn-primary me-2"
                          onClick={this.handleRetry}
                        >
                          🔄 Reintentar
                        </button>
                      )}
                      <button 
                        className="btn btn-outline-secondary me-2"
                        onClick={this.handleReload}
                      >
                        🔄 Recargar página
                      </button>
                      <button 
                        className="btn btn-outline-primary"
                        onClick={this.handleGoHome}
                      >
                        🏠 Ir al inicio
                      </button>
                    </div>

                    {showDetails && this.state.error && (
                      <div className="mt-4">
                        <button 
                          className="btn btn-sm btn-outline-secondary"
                          data-bs-toggle="collapse"
                          data-bs-target="#errorDetails"
                        >
                          📋 Ver detalles técnicos
                        </button>
                        <div className="collapse mt-3" id="errorDetails">
                          <div className="card">
                            <div className="card-body text-start">
                              <h6>Error ID: {this.state.errorId}</h6>
                              <pre className="small text-danger">
                                {this.state.error.message}
                              </pre>
                              {process.env.NODE_ENV === 'development' && (
                                <pre className="small text-muted">
                                  {this.state.error.stack}
                                </pre>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Error de componente (más compacto)
      return (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex align-items-center">
            <div className="me-3">⚠️</div>
            <div className="flex-grow-1">
              <h6 className="alert-heading mb-1">Error en componente</h6>
              <p className="mb-2 small">
                Este componente encontró un error. ID: {this.state.errorId}
              </p>
              <div>
                {this.state.retryCount < 2 && (
                  <button 
                    className="btn btn-sm btn-outline-danger me-2"
                    onClick={this.handleRetry}
                  >
                    🔄 Reintentar
                  </button>
                )}
                {showDetails && (
                  <button 
                    className="btn btn-sm btn-outline-secondary"
                    data-bs-toggle="collapse"
                    data-bs-target={`#errorDetails-${this.state.errorId}`}
                  >
                    📋 Detalles
                  </button>
                )}
              </div>
              
              {showDetails && (
                <div className="collapse mt-2" id={`errorDetails-${this.state.errorId}`}>
                  <pre className="small text-danger mb-0">
                    {this.state.error?.message}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC para wrappear componentes con error boundary
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WrappedComponent = React.forwardRef((props, ref) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} ref={ref} />
    </ErrorBoundary>
  ));

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook para capturar errores en componentes funcionales
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error) => {
    setError(error);
    
    // Enviar error a telemetría
    if (process.env.NODE_ENV === 'production') {
      console.error('Unhandled error:', error);
    }
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
};

export default ErrorBoundary;