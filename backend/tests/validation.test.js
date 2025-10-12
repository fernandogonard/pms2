// Test suite para el sistema de validaciones con Joi
const request = require('supertest');
const { ValidationError, validate, schemas } = require('../services/validationService');

describe('Validation Service', () => {
  describe('User validation', () => {
    test('should validate valid user data', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'cliente'
      };

      expect(() => validate(schemas.user, userData)).not.toThrow();
    });

    test('should throw error for invalid email', () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123',
        role: 'cliente'
      };

      expect(() => validate(schemas.user, userData)).toThrow(ValidationError);
    });

    test('should throw error for short password', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123',
        role: 'cliente'
      };

      expect(() => validate(schemas.user, userData)).toThrow(ValidationError);
    });

    test('should throw error for invalid role', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'invalid_role'
      };

      expect(() => validate(schemas.user, userData)).toThrow(ValidationError);
    });
  });

  describe('Room validation', () => {
    test('should validate valid room data', () => {
      const roomData = {
        number: 101,
        type: 'Individual',
        price: 100,
        floor: 1,
        status: 'disponible',
        capacity: 2
      };

      expect(() => validate(schemas.room, roomData)).not.toThrow();
    });

    test('should throw error for invalid room number', () => {
      const roomData = {
        number: -1,
        type: 'Individual',
        price: 100,
        floor: 1
      };

      expect(() => validate(schemas.room, roomData)).toThrow(ValidationError);
    });

    test('should throw error for negative price', () => {
      const roomData = {
        number: 101,
        type: 'Individual',
        price: -50,
        floor: 1
      };

      expect(() => validate(schemas.room, roomData)).toThrow(ValidationError);
    });

    test('should apply default values', () => {
      const roomData = {
        number: 101,
        type: 'Individual',
        price: 100,
        floor: 1
      };

      const validated = validate(schemas.room, roomData);
      expect(validated.status).toBe('disponible');
      expect(validated.capacity).toBe(2);
      expect(validated.amenities).toEqual([]);
    });
  });

  describe('Reservation validation', () => {
    test('should validate valid reservation data', () => {
      const reservationData = {
        clientId: '507f1f77bcf86cd799439011',
        roomId: '507f1f77bcf86cd799439012',
        checkIn: '2024-12-25',
        checkOut: '2024-12-28',
        guests: 2,
        totalPrice: 300
      };

      expect(() => validate(schemas.reservation, reservationData)).not.toThrow();
    });

    test('should throw error if checkOut is before checkIn', () => {
      const reservationData = {
        clientId: '507f1f77bcf86cd799439011',
        roomId: '507f1f77bcf86cd799439012',
        checkIn: '2024-12-28',
        checkOut: '2024-12-25',
        guests: 2,
        totalPrice: 300
      };

      expect(() => validate(schemas.reservation, reservationData)).toThrow(ValidationError);
    });

    test('should throw error for invalid guest count', () => {
      const reservationData = {
        clientId: '507f1f77bcf86cd799439011',
        roomId: '507f1f77bcf86cd799439012',
        checkIn: '2024-12-25',
        checkOut: '2024-12-28',
        guests: 0,
        totalPrice: 300
      };

      expect(() => validate(schemas.reservation, reservationData)).toThrow(ValidationError);
    });
  });

  describe('Client validation', () => {
    test('should validate valid client data', () => {
      const clientData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        idType: 'dni',
        idNumber: '12345678'
      };

      expect(() => validate(schemas.client, clientData)).not.toThrow();
    });

    test('should throw error for invalid phone format', () => {
      const clientData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: 'invalid-phone',
        idType: 'dni',
        idNumber: '12345678'
      };

      expect(() => validate(schemas.client, clientData)).toThrow(ValidationError);
    });

    test('should throw error for short ID number', () => {
      const clientData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        idType: 'dni',
        idNumber: '123'
      };

      expect(() => validate(schemas.client, clientData)).toThrow(ValidationError);
    });
  });

  describe('MongoDB ID validation', () => {
    test('should validate valid ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011';
      expect(() => validate(schemas.mongoId, validId)).not.toThrow();
    });

    test('should throw error for invalid ObjectId', () => {
      const invalidId = 'invalid-id';
      expect(() => validate(schemas.mongoId, invalidId)).toThrow(ValidationError);
    });
  });

  describe('Login validation', () => {
    test('should validate valid login data', () => {
      const loginData = {
        email: 'user@example.com',
        password: 'password123'
      };

      expect(() => validate(schemas.login, loginData)).not.toThrow();
    });

    test('should throw error for invalid email in login', () => {
      const loginData = {
        email: 'invalid-email',
        password: 'password123'
      };

      expect(() => validate(schemas.login, loginData)).toThrow(ValidationError);
    });

    test('should throw error for missing password', () => {
      const loginData = {
        email: 'user@example.com'
      };

      expect(() => validate(schemas.login, loginData)).toThrow(ValidationError);
    });
  });

  describe('Date range validation', () => {
    test('should validate valid date range', () => {
      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      expect(() => validate(schemas.dateRange, dateRange)).not.toThrow();
    });

    test('should throw error if endDate is before startDate', () => {
      const dateRange = {
        startDate: '2024-01-31',
        endDate: '2024-01-01'
      };

      expect(() => validate(schemas.dateRange, dateRange)).toThrow(ValidationError);
    });
  });

  describe('Pagination validation', () => {
    test('should validate and apply default pagination values', () => {
      const paginationData = {};
      const validated = validate(schemas.pagination, paginationData);
      
      expect(validated.page).toBe(1);
      expect(validated.limit).toBe(20);
      expect(validated.sort).toBe('desc');
      expect(validated.sortBy).toBe('createdAt');
    });

    test('should validate custom pagination values', () => {
      const paginationData = {
        page: 2,
        limit: 50,
        sort: 'asc',
        sortBy: 'name'
      };

      const validated = validate(schemas.pagination, paginationData);
      expect(validated).toEqual(paginationData);
    });

    test('should throw error for invalid page number', () => {
      const paginationData = {
        page: 0
      };

      expect(() => validate(schemas.pagination, paginationData)).toThrow(ValidationError);
    });

    test('should throw error for excessive limit', () => {
      const paginationData = {
        limit: 1000
      };

      expect(() => validate(schemas.pagination, paginationData)).toThrow(ValidationError);
    });
  });
});

// Integration tests omitidos por ahora para evitar importar app completo