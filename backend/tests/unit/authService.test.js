// tests/unit/authService.test.js
// Tests unitarios completos para authService

const authService = require('../../services/authService');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mockear dependencias
jest.mock('../../models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const mockUserData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'TestPass123!',
      role: 'cliente'
    };

    it('should register a new user successfully', async () => {
      // Arrange
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedPassword');
      const mockUser = { 
        _id: 'userId123',
        ...mockUserData,
        password: 'hashedPassword',
        save: jest.fn().mockResolvedValue(true)
      };
      User.prototype.constructor = jest.fn().mockReturnValue(mockUser);
      jwt.sign.mockReturnValue('mockToken');

      // Act
      const result = await authService.register(mockUserData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBe('mockToken');
      expect(User.findOne).toHaveBeenCalledWith({ email: mockUserData.email });
      expect(bcrypt.hash).toHaveBeenCalledWith(mockUserData.password, 12);
    });

    it('should fail if user already exists', async () => {
      // Arrange
      User.findOne.mockResolvedValue({ email: mockUserData.email });

      // Act
      const result = await authService.register(mockUserData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('El email ya está en uso');
    });

    it('should validate email format', async () => {
      // Arrange
      const invalidUserData = {
        ...mockUserData,
        email: 'invalid-email'
      };

      // Act
      const result = await authService.register(invalidUserData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Email inválido');
    });

    it('should validate password strength', async () => {
      // Arrange
      const weakPasswordData = {
        ...mockUserData,
        password: '123'
      };

      // Act
      const result = await authService.register(weakPasswordData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Contraseña debe tener al menos');
    });
  });

  describe('login', () => {
    const mockCredentials = {
      email: 'test@example.com',
      password: 'TestPass123!'
    };

    it('should login successfully with valid credentials', async () => {
      // Arrange
      const mockUser = {
        _id: 'userId123',
        email: mockCredentials.email,
        password: 'hashedPassword',
        role: 'cliente',
        name: 'Test User'
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mockToken');

      // Act
      const result = await authService.login(mockCredentials);

      // Assert
      expect(result.success).toBe(true);
      expect(result.token).toBe('mockToken');
      expect(result.user.email).toBe(mockCredentials.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(mockCredentials.password, 'hashedPassword');
    });

    it('should fail with invalid email', async () => {
      // Arrange
      User.findOne.mockResolvedValue(null);

      // Act
      const result = await authService.login(mockCredentials);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Credenciales inválidas');
    });

    it('should fail with invalid password', async () => {
      // Arrange
      const mockUser = {
        _id: 'userId123',
        email: mockCredentials.email,
        password: 'hashedPassword'
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      // Act
      const result = await authService.login(mockCredentials);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Credenciales inválidas');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      // Arrange
      const refreshToken = 'validRefreshToken';
      const mockDecoded = { userId: 'userId123', type: 'refresh' };
      const mockUser = {
        _id: 'userId123',
        email: 'test@example.com',
        role: 'cliente'
      };
      
      jwt.verify.mockReturnValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('newAccessToken');

      // Act
      const result = await authService.refreshToken(refreshToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.token).toBe('newAccessToken');
      expect(jwt.verify).toHaveBeenCalledWith(refreshToken, process.env.JWT_SECRET);
    });

    it('should fail with invalid refresh token', async () => {
      // Arrange
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = await authService.refreshToken('invalidToken');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Refresh token inválido');
    });
  });

  describe('changePassword', () => {
    const userId = 'userId123';
    const currentPassword = 'oldPassword';
    const newPassword = 'NewPassword123!';

    it('should change password successfully', async () => {
      // Arrange
      const mockUser = {
        _id: userId,
        password: 'hashedOldPassword',
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashedNewPassword');

      // Act
      const result = await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result.success).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, 'hashedOldPassword');
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should fail with incorrect current password', async () => {
      // Arrange
      const mockUser = {
        _id: userId,
        password: 'hashedOldPassword'
      };
      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      // Act
      const result = await authService.changePassword(userId, 'wrongPassword', newPassword);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Contraseña actual incorrecta');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      User.findOne.mockRejectedValue(new Error('Database connection error'));

      // Act
      const result = await authService.login({ email: 'test@example.com', password: 'password' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Error interno del servidor');
    });
  });
});