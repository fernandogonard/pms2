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

  // Mostrar spinner de carga inicial
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
        <div style={{ fontSize: 24, color: '#60a5fa' }}>⏳ Cargando...</div>
      </div>
    );
  }

  return (
    <div style={loginStyles.page}>
      {/* Panel izquierdo decorativo */}
      <div style={loginStyles.leftPanel}>
        <div style={loginStyles.leftContent}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏨</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>MiHotel PMS</h2>
          <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7, maxWidth: 280 }}>
            Sistema de gestión hotelera completo. Reservas, habitaciones, facturación y más.
          </p>
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['Gestión de reservas en tiempo real', 'Panel de administración completo', 'Reportes y analíticas avanzadas'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 14 }}>
                <span style={{ color: '#3b82f6' }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div style={loginStyles.rightPanel}>
        <div style={loginStyles.formBox}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Iniciar sesión</h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Ingresá tus credenciales para continuar</p>
          </div>

          {error && (
            <div style={loginStyles.errorBox} role="alert">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={loginStyles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
                placeholder="admin@hotel.com"
                style={{ ...loginStyles.input, opacity: isSubmitting ? 0.6 : 1 }}
              />
            </div>
            <div>
              <label style={loginStyles.label}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                placeholder="••••••••"
                style={{ ...loginStyles.input, opacity: isSubmitting ? 0.6 : 1 }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{ ...loginStyles.submitBtn, opacity: isSubmitting ? 0.75 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? '⏳ Iniciando sesión...' : 'Entrar →'}
            </button>
          </form>

          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: '#334155' }}>
            ¿Problemas para acceder? Contactá al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  );
};

const loginStyles = {
  page: {
    height: '100vh',
    display: 'flex',
    background: '#0f1117',
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '0 0 420px',
    background: 'linear-gradient(160deg, #1e3a5f 0%, #0f1117 60%)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    '@media (max-width: 768px)': { display: 'none' },
  },
  leftContent: {
    maxWidth: 320,
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  formBox: {
    width: '100%',
    maxWidth: 400,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 40,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 15,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    marginTop: 4,
  },
  errorBox: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 14,
    marginBottom: 20,
  },
};

export default Login;
