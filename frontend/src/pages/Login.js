// pages/Login.js
// Página de login mejorada con contexto de autenticación
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, isAuthenticated, error, clearError, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirigir si ya está autenticado
  useEffect(() => {
    console.log('🔍 [Login] Estado de autenticación:', {
      isAuthenticated,
      loading,
      userRole: user?.role,
      userEmail: user?.email,
      hasLocation: !!location,
      locationState: location.state
    });
    
    if (isAuthenticated && !loading && user) {
      // Determinar ruta basada en el rol
      let targetRoute = '/';
      if (user.role === 'admin') {
        targetRoute = '/admin';
      } else if (user.role === 'recepcionista') {
        targetRoute = '/recepcion';
      }
      
      const from = location.state?.from || targetRoute;
      console.log('🔄 [Login] Redirigiendo usuario autenticado a:', from);
      console.log('👤 [Login] Usuario:', user.email, 'Rol:', user.role);
      
      navigate(from, { replace: true });
    } else if (isAuthenticated && !loading && !user) {
      console.log('⚠️ [Login] Usuario autenticado pero sin datos de usuario');
    }
  }, [isAuthenticated, loading, user, navigate, location]);

  // Limpiar errores al cambiar los campos
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [email, password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const result = await login({ email, password });
      
      if (result.success) {
        // La redirección se maneja en el useEffect de arriba
      }
    } catch (err) {
      console.error('Error en login:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estilos para la página de login con gradiente de fondo
  const pageStyle = {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
    position: 'relative'
  };

  // Estilos para el formulario con mayor contraste
  const formContainerStyle = {
    maxWidth: 400,
    padding: 32,
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0, 100, 255, 0.3)',
    border: '1px solid rgba(0, 100, 255, 0.2)',
    color: 'white',
    backdropFilter: 'blur(5px)',
    zIndex: 2
  };

  // Estilo para el overlay decorativo
  const overlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1
  };

  // Mostrar spinner de carga inicial
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={overlayStyle}></div>
      <div style={formContainerStyle}>
        <h2 style={{ color: '#0099ff', marginBottom: 24, textAlign: 'center', fontWeight: 600, textShadow: '0 0 8px rgba(0, 153, 255, 0.5)' }}>
          Iniciar sesión
        </h2>
        
        {error && (
          <div className="alert alert-danger" role="alert" style={{ backgroundColor: 'rgba(220, 53, 69, 0.8)', border: '1px solid #dc3545', color: 'white' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#fff', display: 'block', marginBottom: 5, fontSize: '14px' }}>
              Email
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              disabled={isSubmitting}
              required 
              style={{ 
                width: '100%', 
                padding: 10, 
                marginTop: 4, 
                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                color: 'white', 
                border: '1px solid rgba(0, 153, 255, 0.3)', 
                borderRadius: 6,
                opacity: isSubmitting ? 0.6 : 1
              }} 
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#fff', display: 'block', marginBottom: 5, fontSize: '14px' }}>
              Contraseña
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              disabled={isSubmitting}
              required 
              style={{ 
                width: '100%', 
                padding: 10, 
                marginTop: 4, 
                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                color: 'white', 
                border: '1px solid rgba(0, 153, 255, 0.3)', 
                borderRadius: 6,
                opacity: isSubmitting ? 0.6 : 1
              }} 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isSubmitting}
            style={{ 
              width: '100%', 
              background: isSubmitting 
                ? 'rgba(0, 153, 255, 0.6)' 
                : 'linear-gradient(135deg, #0099ff, #004c99)', 
              color: '#fff', 
              padding: 12, 
              border: 'none', 
              borderRadius: 6, 
              fontWeight: 'bold', 
              boxShadow: '0 4px 10px rgba(0, 100, 255, 0.3)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {isSubmitting && (
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            )}
            {isSubmitting ? 'Iniciando sesión...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
