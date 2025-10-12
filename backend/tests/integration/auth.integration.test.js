// tests/integration/auth.integration.test.js
// Tests de integración para el sistema de autenticación

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const { connectDB, disconnectDB, clearDB } = require('../setup/testDatabase');

describe('Authentication Integration Tests', () => {
  let server;

  beforeAll(async () => {
    await connectDB();
    server = app.listen(0); // Puerto aleatorio para tests
  });

  afterAll(async () => {
    await server.close();
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDB();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      name: 'Test User Integration',
      email: 'integration@test.com',
      password: 'TestPass123!',
      role: 'cliente'
    };

    it('should register a new user and return token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(validUserData.email);
      expect(response.body.user.password).toBeUndefined(); // No debe devolver la contraseña

      // Verificar que el usuario se guardó en la base de datos
      const savedUser = await User.findOne({ email: validUserData.email });
      expect(savedUser).toBeTruthy();
      expect(savedUser.name).toBe(validUserData.name);
    });

    it('should fail with duplicate email', async () => {
      // Crear usuario primero
      await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      // Intentar crear el mismo usuario nuevamente
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email ya está en uso');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        email: 'test@example.com'
        // Faltan name, password, role
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validUserData,
        email: 'invalid-email-format'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Email inválido');
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...validUserData,
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Contraseña debe tener');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Crear un usuario para las pruebas de login
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login Test User',
          email: 'login@test.com',
          password: 'TestPass123!',
          role: 'cliente'
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'TestPass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe('login@test.com');
      expect(response.body.user.password).toBeUndefined();
    });

    it('should fail with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'TestPass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Credenciales inválidas');
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Credenciales inválidas');
    });

    it('should return user role information', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'TestPass123!'
        })
        .expect(200);

      expect(response.body.user.role).toBe('cliente');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      // Crear usuario y obtener refresh token
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Refresh Test User',
          email: 'refresh@test.com',
          password: 'TestPass123!',
          role: 'cliente'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh@test.com',
          password: 'TestPass123!'
        });

      refreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.token).not.toBe(refreshToken);
    });

    it('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Refresh token inválido');
    });

    it('should fail without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Protected Routes', () => {
    let accessToken;
    let userId;

    beforeEach(async () => {
      // Crear usuario y obtener token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Protected Route User',
          email: 'protected@test.com',
          password: 'TestPass123!',
          role: 'admin'
        });

      accessToken = registerResponse.body.token;
      userId = registerResponse.body.user._id;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should fail to access protected route without token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Token no proporcionado');
    });

    it('should fail to access protected route with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Token inválido');
    });
  });

  describe('Role-based Access Control', () => {
    let adminToken, clientToken;

    beforeEach(async () => {
      // Crear usuario admin
      const adminResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'AdminPass123!',
          role: 'admin'
        });
      adminToken = adminResponse.body.token;

      // Crear usuario cliente
      const clientResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Client User',
          email: 'client@test.com',
          password: 'ClientPass123!',
          role: 'cliente'
        });
      clientToken = clientResponse.body.token;
    });

    it('should allow admin access to admin routes', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny client access to admin routes', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No tienes permisos');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login attempts', async () => {
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'WrongPassword123!'
      };

      // Hacer múltiples intentos de login fallidos
      const promises = Array(6).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Los primeros 5 deberían ser 401 (credenciales inválidas)
      // El 6º debería ser 429 (rate limited)
      const rateLimitedResponse = responses.find(res => res.status === 429);
      expect(rateLimitedResponse).toBeTruthy();
      expect(rateLimitedResponse.body.message).toContain('Demasiados intentos');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password'
        });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});