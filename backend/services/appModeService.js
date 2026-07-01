// services/appModeService.js
// Resolver centralizado para separar operaciones demo vs produccion.

const ALLOWED_MODES = new Set(['demo', 'production']);

function normalizeMode(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_MODES.has(normalized) ? normalized : null;
}

function getDefaultMode() {
  return normalizeMode(process.env.APP_MODE) || 'production';
}

function resolveAppMode(req) {
  if (!req) return getDefaultMode();

  const headerMode = normalizeMode(req.headers && req.headers['x-app-mode']);
  if (headerMode) return headerMode;

  const queryMode = normalizeMode(req.query && req.query.mode);
  if (queryMode) return queryMode;

  return getDefaultMode();
}

function buildModeQuery(mode, includeLegacyInProduction = true) {
  const normalizedMode = normalizeMode(mode) || getDefaultMode();

  if (normalizedMode === 'demo') {
    return { mode: 'demo' };
  }

  if (!includeLegacyInProduction) {
    return { mode: 'production' };
  }

  // Compatibilidad: registros antiguos sin campo mode se consideran produccion.
  return {
    $or: [
      { mode: 'production' },
      { mode: { $exists: false } }
    ]
  };
}

module.exports = {
  normalizeMode,
  getDefaultMode,
  resolveAppMode,
  buildModeQuery
};
