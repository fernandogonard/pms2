// contexts/AuthContext.js
// Contexto de autenticación para el frontend

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext();

// Estados de autenticación
const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        loading: false,
        error: null
      };
    
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        loading: false,
        error: null
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    
    case 'TOKEN_REFRESHED':
      return {
        ...state,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken
      };
    
    default:
      return state;
  }
};

// Estado inicial
const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  loading: true,
  error: null
};

// Hook personalizado para usar el contexto de autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Proveedor de autenticación
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Flag para prevenir inicialización múltiple
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Inicializar autenticación al cargar la app - solo una vez
  useEffect(() => {
    if (isInitialized) {
      console.log('⚠️ [AuthContext] Evitando inicialización duplicada');
      return;
    }
    
    let isMounted = true;
    const initAuth = async () => {
      if (isMounted && !isInitialized) {
        console.log('🚀 [AuthContext] Primera inicialización');
        setIsInitialized(true);
        await initializeAuth();
      }
    };
    initAuth();
    return () => { isMounted = false; };
  }, [isInitialized]);

  // Inicializar estado de autenticación desde localStorage
  const initializeAuth = async () => {
    try {
      console.log('🔍 [AuthContext] Inicializando autenticación...');
      
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      const user = localStorage.getItem('user');

      console.log('📦 [AuthContext] Datos en localStorage:', {
        hasToken: !!token,
        hasRefreshToken: !!refreshToken,
        hasUser: !!user,
        tokenLength: token ? token.length : 0
      });

      if (token && user) {
        try {
          const parsedUser = JSON.parse(user);
          console.log('👤 [AuthContext] Usuario parseado:', {
            email: parsedUser.email,
            role: parsedUser.role,
            name: parsedUser.name
          });
          
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: {
              user: parsedUser,
              token,
              refreshToken
            }
          });

          console.log('✅ [AuthContext] Estado de autenticación restaurado');
          
          // NO verificar token inmediatamente - confiar en localStorage temporalmente
          console.log('⏭️ [AuthContext] Saltando verificación inmediata de token para evitar duplicados');
          
        } catch (error) {
          console.error('🚨 [AuthContext] Error parseando usuario:', error);
          clearAuthData();
        }
      } else {
        console.log('📭 [AuthContext] Sin datos de autenticación en localStorage');
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      console.error('🚨 [AuthContext] Error inicializando autenticación:', error);
      clearAuthData();
    }
  };

  // Manejar renovación de token
  const handleRefreshToken = async (refreshToken) => {
    try {
      const response = await apiFetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();

      if (data.success) {
        const { token: newToken, refreshToken: newRefreshToken, user } = data;
        
        // Actualizar localStorage
        localStorage.setItem('token', newToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user,
            token: newToken,
            refreshToken: newRefreshToken
          }
        });
      } else {
        clearAuthData();
      }
    } catch (error) {
      console.error('Error renovando token:', error);
      clearAuthData();
    }
  };

  // Limpiar datos de autenticación
  const clearAuthData = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    dispatch({ type: 'LOGOUT' });
  };

  // Login
  const login = async (credentials) => {
    try {
      console.log('🔐 [AuthContext] Iniciando login para:', credentials.email);
      
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      console.log('📡 [AuthContext] Respuesta login:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📄 [AuthContext] Datos login:', {
          success: data.success,
          hasUser: !!data.user,
          hasToken: !!data.token,
          userEmail: data.user?.email
        });

        if (data.success) {
          const { user, token, refreshToken } = data;
          
          console.log('✅ [AuthContext] Login exitoso para:', user.email);
          
          // Guardar en localStorage
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', refreshToken);
          localStorage.setItem('user', JSON.stringify(user));

          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user, token, refreshToken }
          });

          return { success: true };
        } else {
          const errorMessage = data.message || 'Error en el login';
          console.error('❌ [AuthContext] Login falló:', errorMessage);
          dispatch({
            type: 'SET_ERROR',
            payload: errorMessage
          });
          return { success: false, message: errorMessage };
        }
      } else {
        let errorMessage = 'Error en el login';
        try {
          const data = await response.json();
          errorMessage = data.message || errorMessage;
        } catch (e) {
          console.log('No se pudo parsear respuesta de error');
        }
        
        console.error('❌ [AuthContext] Login HTTP error:', response.status, errorMessage);
        dispatch({
          type: 'SET_ERROR',
          payload: errorMessage
        });
        return { success: false, message: errorMessage };
      }
    } catch (error) {
      console.error('🚨 [AuthContext] Excepción en login:', error);
      const errorMessage = error.message || 'Error de conexión';
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage
      });
      return { success: false, message: errorMessage };
    }
  };

  // Registro
  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (data.success) {
        const { user, token, refreshToken } = data;
        
        // Guardar en localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token, refreshToken }
        });

        return { success: true };
      } else {
        dispatch({
          type: 'SET_ERROR',
          payload: data.message || 'Error en el registro'
        });
        return { success: false, message: data.message };
      }
    } catch (error) {
      const errorMessage = error.message || 'Error de conexión';
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage
      });
      return { success: false, message: errorMessage };
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Intentar logout en el servidor
      if (state.token) {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.token}`
          }
        });
      }
    } catch (error) {
      console.error('Error en logout del servidor:', error);
    } finally {
      clearAuthData();
    }
  };

  // Cambiar contraseña
  const changePassword = async (currentPassword, newPassword) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (response.success) {
        return { success: true, message: response.message };
      } else {
        dispatch({
          type: 'SET_ERROR',
          payload: response.message
        });
        return { success: false, message: response.message };
      }
    } catch (error) {
      const errorMessage = error.message || 'Error cambiando contraseña';
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage
      });
      return { success: false, message: errorMessage };
    }
  };

  // Limpiar errores
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Verificar si el usuario tiene un rol específico
  const hasRole = (role) => {
    return state.user?.role === role;
  };

  // Verificar si el usuario tiene uno de varios roles
  const hasAnyRole = (roles) => {
    return state.user && roles.includes(state.user.role);
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    changePassword,
    clearError,
    hasRole,
    hasAnyRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;