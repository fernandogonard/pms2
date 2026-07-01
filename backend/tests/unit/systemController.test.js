const fs = require('fs');
const path = require('path');

jest.mock('../../services/errorHandlingService', () => ({
  asyncWrapper: (fn) => fn
}));

jest.mock('../../scripts/createBackup', () => ({
  createBackup: jest.fn()
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connection: {
      readyState: 1,
      db: {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 })
        })
      }
    }
  };
});

const mongoose = require('mongoose');
const { createBackup } = require('../../scripts/createBackup');
const systemController = require('../../controllers/systemController');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    }
  };
}

describe('systemController hardening', () => {
  const backupsDir = path.resolve(__dirname, '../../backups');

  beforeEach(() => {
    jest.clearAllMocks();
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    for (const file of fs.readdirSync(backupsDir)) {
      fs.unlinkSync(path.join(backupsDir, file));
    }
  });

  afterAll(() => {
    if (fs.existsSync(backupsDir)) {
      for (const file of fs.readdirSync(backupsDir)) {
        fs.unlinkSync(path.join(backupsDir, file));
      }
    }
  });

  test('healthCheck returns 200 when DB is connected and ping succeeds', async () => {
    mongoose.connection.readyState = 1;
    mongoose.connection.db.admin = () => ({
      ping: jest.fn().mockResolvedValue({ ok: 1 })
    });

    const res = createRes();
    await systemController.healthCheck({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('ok');
    expect(res.payload.components.database.status).toBe('ok');
    expect(res.payload.components.database.pingMs).not.toBeNull();
  });

  test('healthCheck returns 503 when DB is disconnected', async () => {
    mongoose.connection.readyState = 0;

    const res = createRes();
    await systemController.healthCheck({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('degraded');
    expect(res.payload.checks.databaseConnected).toBe(false);
  });

  test('healthCheck marks backups degraded when there are no backups', async () => {
    mongoose.connection.readyState = 1;

    const res = createRes();
    await systemController.healthCheck({}, res);

    expect(res.payload.components.backups.status).toBe('degraded');
    expect(res.payload.components.backups.totalBackups).toBe(0);
    expect(res.payload.checks.backupsAvailable).toBe(false);
  });

  test('healthCheck detects backups when present', async () => {
    const fileName = `backup_json_${Date.now()}.json`;
    fs.writeFileSync(path.join(backupsDir, fileName), JSON.stringify({ metadata: {} }), 'utf8');

    const res = createRes();
    await systemController.healthCheck({}, res);

    expect(res.payload.components.backups.status).toBe('ok');
    expect(res.payload.components.backups.totalBackups).toBeGreaterThan(0);
    expect(res.payload.components.backups.latestBackup.file).toBe(fileName);
  });

  test('healthCheck includes memory metrics', async () => {
    const res = createRes();
    await systemController.healthCheck({}, res);

    expect(res.payload.memory).toHaveProperty('rssBytes');
    expect(res.payload.memory).toHaveProperty('heapUsedMB');
    expect(typeof res.payload.memory.heapUsedMB).toBe('number');
  });

  test('healthCheck handles high memory values', async () => {
    const memorySpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 2 * 1024 * 1024 * 1024,
      heapUsed: 1400 * 1024 * 1024,
      heapTotal: 1500 * 1024 * 1024,
      external: 50 * 1024 * 1024,
      arrayBuffers: 0
    });

    const res = createRes();
    await systemController.healthCheck({}, res);

    expect(res.payload.memory.rssMB).toBeGreaterThan(1000);
    expect(res.payload.memory.heapUsedMB).toBeGreaterThan(1000);

    memorySpy.mockRestore();
  });

  test('runBackupNow returns 500 when backup fails', async () => {
    createBackup.mockResolvedValue({ success: false, error: 'backup failed' });

    const res = createRes();
    await systemController.runBackupNow({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload.success).toBe(false);
  });

  test('listBackups returns backups list', async () => {
    const fileName = `backup_json_${Date.now()}.json`;
    fs.writeFileSync(path.join(backupsDir, fileName), JSON.stringify({ metadata: {} }), 'utf8');

    const res = createRes();
    await systemController.listBackups({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(res.payload.count).toBeGreaterThan(0);
  });

  test('getLatestBackup returns 404 when no backups', async () => {
    const res = createRes();
    await systemController.getLatestBackup({}, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload.success).toBe(false);
  });
});
