const fs = require('fs');
const path = require('path');

const DIAG_DIR = path.resolve(__dirname, '../tmp');
const DIAG_FILE = path.join(DIAG_DIR, 'http-error-diagnostics.ndjson');

function ensureDir() {
  if (!fs.existsSync(DIAG_DIR)) {
    fs.mkdirSync(DIAG_DIR, { recursive: true });
  }
}

function summarizeStack(stack) {
  if (!stack || typeof stack !== 'string') return null;
  const lines = stack.split('\n').map((line) => line.trim()).filter(Boolean);
  const summary = lines.slice(0, 6);
  return summary;
}

function extractFileLine(stack) {
  if (!stack || typeof stack !== 'string') return { file: null, line: null };

  const lines = stack.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes('at ')) continue;
    if (line.includes('node_modules')) continue;

    const match = line.match(/\((.*):(\d+):(\d+)\)$/) || line.match(/at (.*):(\d+):(\d+)$/);
    if (match) {
      return {
        file: match[1],
        line: Number(match[2])
      };
    }
  }

  return { file: null, line: null };
}

function appendDiagnostic(entry) {
  try {
    ensureDir();
    fs.appendFileSync(DIAG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (_err) {
    // Logging diagnóstico no debe romper flujo de negocio.
  }
}

function clearDiagnostics() {
  ensureDir();
  fs.writeFileSync(DIAG_FILE, '', 'utf8');
}

function logEndpointError({
  req,
  endpoint,
  statusCode,
  startedAt,
  error,
  category = 'Otro'
}) {
  const durationMs = startedAt ? Date.now() - startedAt : null;
  const stack = error && error.stack ? error.stack : null;
  const location = extractFileLine(stack);

  appendDiagnostic({
    ts: new Date().toISOString(),
    requestId: req?.requestId || null,
    endpoint,
    method: req?.method || null,
    statusCode: statusCode || 500,
    durationMs,
    category,
    errorName: error?.name || null,
    errorMessage: error?.message || 'Unknown error',
    errorStack: stack,
    stackSummary: summarizeStack(stack),
    sourceFile: location.file,
    sourceLine: location.line,
    ip: req?.ip || null,
    originalUrl: req?.originalUrl || null
  });
}

module.exports = {
  DIAG_FILE,
  clearDiagnostics,
  logEndpointError
};
