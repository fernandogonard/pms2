// frontend/src/components/CriticalErrorBoundary.js
// Error Boundary crítico para evitar crashes del sistema

import React from 'react';
import '../styles/performance.css';

class CriticalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0,
      maxRetries: 3
    };
    
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReportError = this.handleReportError.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Actualizar state para mostrar la UI de error
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Logear error para monitoreo
    this.setState({
      error,
      errorInfo
    });

    // Enviar error a servicio de monitoreo en producción
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService(error, errorInfo) {
    try {
      // En producción, esto enviaría a un servicio como Sentry
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: localStorage.getItem('userId'),
        retryCount: this.state.retryCount
      };

      // Guardar en localStorage para debugging
      const errors = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      errors.push(errorData);
      
      // Mantener solo los últimos 10 errores
      if (errors.length > 10) {
        errors.splice(0, errors.length - 10);
      }
      
      localStorage.setItem('errorLogs', JSON.stringify(errors));

      // Log a consola en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.group('🚨 Error Boundary Caught Error');
        console.error('Error:', error);
        console.error('Error Info:', errorInfo);
        console.error('Component Stack:', errorInfo.componentStack);
        console.groupEnd();
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  handleRetry() {
    if (this.state.retryCount < this.state.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    } else {
      // Máximo de reintentos alcanzado, recargar página
      window.location.reload();
    }
  }

  handleReportError() {
    const errorReport = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount
    };

    const subject = encodeURIComponent('Error Report - Hotel CRM');
    const body = encodeURIComponent(`
Error Report:
${JSON.stringify(errorReport, null, 2)}

Please describe what you were doing when this error occurred:
[Your description here]
    `);
    
    window.open(`mailto:support@hotelcrm.com?subject=${subject}&body=${body}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="container mt-5">
            <div className="row justify-content-center">
              <div className="col-md-8">
                <div className="card">
                  <div className="card-body text-center">
                    <h2 className="text-danger mb-4">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      ¡Oops! Algo salió mal
                    </h2>
                    
                    <p className="mb-4">
                      Ha ocurrido un error inesperado en la aplicación. 
                      Nuestro equipo ha sido notificado automáticamente.
                    </p>

                    {this.state.retryCount < this.state.maxRetries && (
                      <div className="mb-4">
                        <button 
                          className="btn btn-primary me-3"
                          onClick={this.handleRetry}
                        >
                          <i className="fas fa-redo me-2"></i>
                          Intentar de nuevo ({this.state.maxRetries - this.state.retryCount} intentos restantes)
                        </button>
                      </div>
                    )}

                    <div className="mb-4">
                      {this.state.retryCount >= this.state.maxRetries ? (
                        <button 
                          className="btn btn-warning me-3"
                          onClick={() => window.location.reload()}
                        >
                          <i className="fas fa-refresh me-2"></i>
                          Recargar página
                        </button>
                      ) : null}
                      
                      <button 
                        className="btn btn-outline-secondary me-3"
                        onClick={() => window.history.back()}
                      >
                        <i className="fas fa-arrow-left me-2"></i>
                        Ir atrás
                      </button>

                      <button 
                        className="btn btn-outline-info"
                        onClick={this.handleReportError}
                      >
                        <i className="fas fa-bug me-2"></i>
                        Reportar error
                      </button>
                    </div>

                    {process.env.NODE_ENV === 'development' && (
                      <details className="mt-4 text-start">
                        <summary className="btn btn-outline-dark btn-sm mb-3">
                          Ver detalles técnicos (Desarrollo)
                        </summary>
                        <div className="alert alert-dark">
                          <h6>Error:</h6>
                          <pre className="mb-3">
                            {this.state.error && this.state.error.toString()}
                          </pre>
                          
                          <h6>Stack Trace:</h6>
                          <pre className="mb-3">
                            {this.state.error && this.state.error.stack}
                          </pre>
                          
                          <h6>Component Stack:</h6>
                          <pre>
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      </details>
                    )}

                    <div className="mt-4 text-muted">
                      <small>
                        <i className="fas fa-info-circle me-1"></i>
                        Si el problema persiste, contacta al administrador del sistema.
                      </small>
                    </div>
                  </div>
                </div>
                
                {/* Información de contacto de emergencia */}
                <div className="card mt-3">
                  <div className="card-body">
                    <h6 className="card-title">
                      <i className="fas fa-phone me-2"></i>
                      Contacto de emergencia
                    </h6>
                    <p className="card-text small">
                      Si necesitas acceso urgente al sistema, contacta:
                      <br/>
                      📞 Soporte técnico: +34 900 123 456
                      <br/>
                      📧 Email: soporte@hotelcrm.com
                      <br/>
                      🕒 Disponible 24/7
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook para reportar errores manualmente
export const useErrorReporting = () => {
  const reportError = (error, context = {}) => {
    try {
      const errorData = {
        message: error.message || 'Unknown error',
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: localStorage.getItem('userId')
      };

      // Guardar en localStorage
      const errors = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      errors.push(errorData);
      localStorage.setItem('errorLogs', JSON.stringify(errors.slice(-10)));

      // Log en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.error('Manual error report:', errorData);
      }

      // En producción enviaría a servicio de monitoreo
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  return { reportError };
};

export default CriticalErrorBoundary;