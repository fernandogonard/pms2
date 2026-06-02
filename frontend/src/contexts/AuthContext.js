// contexts/AuthContext.js
// Contexto de autenticación para el frontend
// SEGURIDAD: Access token solo en memoria (React state). Refresh token en httpOnly cookie.

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { apiFetch, setAccessToken } from '../utils/api';

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
        loading: false,
        error: null
      };
    
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
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
        token: action.payload.token
      };
    
    default:
      return state;
  }
};

// Estado inicial — sin refreshToken en el estado (vive solo en httpOnly cookie)
const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
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
  const initRef = useRef(false);

  // Inicializar autenticación al cargar la app
  // El refresh token está en httpOnly cookie — llamar al backend para obtener access token
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initAuth = async () => {
      try {
        // Intentar obtener nuevo access token via cookie httpOnly
        const response = await apiFetch('/api/auth/refresh-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include' // Envía la cookie automáticamente
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.token && data.user) {
            setAccessToken(data.token);
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: {
                user: data.user,
                token: data.token
              }
            });
            return;
          }
        }
        // No hay sesión activa
        setAccessToken(null);
        dispatch({ type: 'SET_LOADING', payload: false });
      } catch {
        // Error de red — no hay sesión
        setAccessToken(null);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    initAuth();
  }, []);

  // Limpiar datos de autenticación
  const clearAuthData = useCallback(() => {
    setAccessToken(null);
    // Limpiar restos de localStorage legacy (migración)
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    } catch { /* no-op */ }
    dispatch({ type: 'LOGOUT' });
  }, []);

  // Login
  const login = useCallback(async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Recibir la httpOnly cookie del backend
        body: JSON.stringify(credentials)
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          const { user, token } = data;

          setAccessToken(token);
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user, token }
          });

          return { success: true };
        } else {
          const errorMessage = data.message || 'Error en el login';
          dispatch({ type: 'SET_ERROR', payload: errorMessage });
          return { success: false, message: errorMessage };
        }
      } else {
        let errorMessage = 'Error en el login';
        try {
          const data = await response.json();
          errorMessage = data.message || errorMessage;
        } catch { /* no-op */ }
        
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        return { success: false, message: errorMessage };
      }
    } catch (error) {
      const errorMessage = error.message || 'Error de conexión';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  }, []);

  // Registro
  const register = useCallback(async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (data.success) {
        const { user, token } = data;

        setAccessToken(token);
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token }
        });

        return { success: true };
      } else {
        dispatch({ type: 'SET_ERROR', payload: data.message || 'Error en el registro' });
        return { success: false, message: data.message };
      }
    } catch (error) {
      const errorMessage = error.message || 'Error de conexión';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      if (state.token) {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${state.token}` },
          credentials: 'include' // Backend limpia la cookie
        });
      }
    } catch { /* no-op */ } finally {
      clearAuthData();
    }
  }, [state.token, clearAuthData]);

  // Cambiar contraseña
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${state.token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (response.success) {
        return { success: true, message: response.message };
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message });
        return { success: false, message: response.message };
      }
    } catch (error) {
      const errorMessage = error.message || 'Error cambiando contraseña';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  }, [state.token]);

  // Limpiar errores
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Verificar si el usuario tiene un rol específico
  const hasRole = useCallback((role) => {
    return state.user?.role === role;
  }, [state.user]);

  // Verificar si el usuario tiene uno de varios roles
  const hasAnyRole = useCallback((roles) => {
    return state.user && roles.includes(state.user.role);
  }, [state.user]);

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