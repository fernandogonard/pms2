const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.OPS_BASE_URL || process.env.STRESS_BASE_URL || 'http://localhost:3001';
const DURATION_MINUTES = Number(process.env.OPS_DURATION_MINUTES || 30);
const INTERVAL_SECONDS = Number(process.env.OPS_INTERVAL_SECONDS || 60);
const OUTPUT_FILE = process.env.OPS_CONTINUOUS_OUTPUT || path.resolve(__dirname, '../OPS-CONTINUOUS-REPORT.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(method, route, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(`${BASE_URL}${route}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - startedAt,
      error: error.message,
      body: null
    };
  }

  const elapsedMs = Date.now() - startedAt;
  const raw = await response.text();
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (_err) {
    parsed = { raw };
  }

  return {
    ok: response.ok,
    status: response.status,
    elapsedMs,
    body: parsed,
    error: null
  };
}

async function authenticate() {
  const login = await api('POST', '/api/auth/login', {
    body: { email: 'admin@hotel.com', password: 'admin123' }
  });

  if (login.ok && login.body && login.body.token) {
    return login.body.token;
  }

  const ts = Date.now();
  const email = `ops-monitor-${ts}@hotel.com`;
  const password = 'OpsMonitor123!';

  const register = await api('POST', '/api/auth/register', {
    body: {
      name: 'Ops Monitor',
      email,
      password,
      role: 'admin'
    }
  });

  if (register.ok && register.body && register.body.token) {
    return register.body.token;
  }

  throw new Error(`No se pudo autenticar monitor. login=${login.status}, register=${register.status}`);
}

function summaryStats(values) {
  if (!values.length) {
    return { avgMs: 0, p95Ms: 0, maxMs: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  const avgMs = values.reduce((acc, v) => acc + v, 0) / values.length;

  return {
    avgMs: Number(avgMs.toFixed(2)),
    p95Ms: Number(sorted[p95Index].toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2))
  };
}

async function main() {
  const totalTicks = Math.max(1, Math.floor((DURATION_MINUTES * 60) / INTERVAL_SECONDS));
  const startedAt = new Date();

  const report = {
    startedAt: startedAt.toISOString(),
    baseUrl: BASE_URL,
    durationMinutesRequested: DURATION_MINUTES,
    intervalSeconds: INTERVAL_SECONDS,
    ticks: [],
    summary: {
      totalTicks,
      crashes: 0,
      httpFailures: 0,
      memoryLeakSuspected: false,
      memoryTrendMB: []
    },
    verdict: 'NO_GO'
  };

  try {
    const token = await authenticate();

    for (let i = 0; i < totalTicks; i += 1) {
      const tickAt = new Date();

      const [health, reservations] = await Promise.all([
        api('GET', '/api/system/health', { token }),
        api('GET', '/api/reservations?page=1&limit=20', { token })
      ]);

      const tick = {
        index: i + 1,
        at: tickAt.toISOString(),
        healthStatus: health.status,
        healthOk: health.ok,
        healthLatencyMs: health.elapsedMs,
        reservationsStatus: reservations.status,
        reservationsOk: reservations.ok,
        reservationsLatencyMs: reservations.elapsedMs,
        heapUsedMB: health.body?.memory?.heapUsedMB ?? null,
        rssMB: health.body?.memory?.rssMB ?? null,
        errors: []
      };

      if (!health.ok) {
        report.summary.httpFailures += 1;
        if (health.status === 0) report.summary.crashes += 1;
        tick.errors.push(health.error || health.body?.message || 'health_failed');
      }

      if (!reservations.ok) {
        report.summary.httpFailures += 1;
        tick.errors.push(reservations.error || reservations.body?.message || 'reservations_failed');
      }

      if (typeof tick.heapUsedMB === 'number') {
        report.summary.memoryTrendMB.push(tick.heapUsedMB);
      }

      report.ticks.push(tick);

      if (i < totalTicks - 1) {
        await sleep(INTERVAL_SECONDS * 1000);
      }
    }

    const memTrend = report.summary.memoryTrendMB;
    const memDelta = memTrend.length >= 2
      ? Number((memTrend[memTrend.length - 1] - memTrend[0]).toFixed(2))
      : 0;

    const healthLatencies = report.ticks.map((t) => t.healthLatencyMs).filter((v) => typeof v === 'number');
    const reservationsLatencies = report.ticks.map((t) => t.reservationsLatencyMs).filter((v) => typeof v === 'number');

    report.summary.memoryDeltaMB = memDelta;
    report.summary.healthLatency = summaryStats(healthLatencies);
    report.summary.reservationsLatency = summaryStats(reservationsLatencies);
    report.summary.memoryLeakSuspected = memDelta > 120;

    const hasFailures = report.summary.crashes > 0 || report.summary.httpFailures > 0 || report.summary.memoryLeakSuspected;
    report.verdict = hasFailures ? 'NO_GO' : 'GO';
  } catch (error) {
    report.summary.httpFailures += 1;
    report.summary.crashes += 1;
    report.error = error.message;
    report.verdict = 'NO_GO';
  } finally {
    report.endedAt = new Date().toISOString();
    report.durationMs = new Date(report.endedAt).getTime() - new Date(report.startedAt).getTime();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

    console.log(`Reporte continuo guardado en: ${OUTPUT_FILE}`);
    console.log(JSON.stringify({
      verdict: report.verdict,
      crashes: report.summary.crashes,
      httpFailures: report.summary.httpFailures,
      memoryLeakSuspected: report.summary.memoryLeakSuspected,
      memoryDeltaMB: report.summary.memoryDeltaMB
    }, null, 2));
  }
}

main();
