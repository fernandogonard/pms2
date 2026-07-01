const request = require('supertest');
const express = require('express');

jest.mock('../../middlewares/authMiddleware', () => ({
  protect: (req, _res, next) => {
    req.user = {
      role: 'admin',
      userId: '507f1f77bcf86cd799439011',
      id: '507f1f77bcf86cd799439011',
      email: 'admin@test.com'
    };
    next();
  },
  authorize: () => (_req, _res, next) => next()
}));

jest.mock('../../config/rateLimiter', () => ({
  adminLimiter: (_req, _res, next) => next()
}));

jest.mock('../../middlewares/maintenanceMiddleware', () => ({
  validateRealData: (_req, _res, next) => next()
}));

const systemRoutes = require('../../routes/systemRoutes');
const app = express();
app.use('/api/system', systemRoutes);

describe('System routes integration', () => {
  test('GET /api/system/health returns JSON payload', async () => {
    const response = await request(app).get('/api/system/health');

    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('components');
    expect(response.body).toHaveProperty('memory');
  });

  test('GET /api/system/backups returns JSON payload', async () => {
    const response = await request(app).get('/api/system/backups');

    expect([200, 404]).toContain(response.status);
    expect(response.body).toHaveProperty('success');
  });

  test('GET /api/system/backups/latest returns JSON payload', async () => {
    const response = await request(app).get('/api/system/backups/latest');

    expect([200, 404]).toContain(response.status);
    expect(response.body).toHaveProperty('success');
  });
});
