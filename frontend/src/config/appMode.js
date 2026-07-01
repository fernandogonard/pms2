// config/appMode.js
// Fuente unica para el modo funcional de negocio (demo/production).

const ALLOWED = new Set(['demo', 'production']);

function normalizeMode(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return ALLOWED.has(normalized) ? normalized : null;
}

export function getAppMode() {
  // Prioridad: querystring > localStorage > env > production
  if (typeof window !== 'undefined') {
    const modeInQuery = normalizeMode(new URLSearchParams(window.location.search).get('mode'));
    if (modeInQuery) {
      localStorage.setItem('pms-app-mode', modeInQuery);
      return modeInQuery;
    }

    const storedMode = normalizeMode(localStorage.getItem('pms-app-mode'));
    if (storedMode) return storedMode;
  }

  return normalizeMode(process.env.REACT_APP_PMS_MODE) || 'production';
}

export function withModeQuery(path) {
  const mode = getAppMode();
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}mode=${encodeURIComponent(mode)}`;
}
