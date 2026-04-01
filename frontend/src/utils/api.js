// utils/api.js
// Utilidad API con funcionalidad offline para PWA

/**
 * API Cliente unificado
 * URLs FIJAS desde .env
 * Sin detección dinámica
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export async function apiFetch(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorBody = {};
    try {
      errorBody = await response.json();
    } catch (e) {}

    throw new Error(
      errorBody.error || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response;
}

export default apiFetch;
