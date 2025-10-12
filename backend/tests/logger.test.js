// Test suite para el sistema de logging
const { logger } = require('../services/loggerService');
const fs = require('fs');
const path = require('path');

describe('Logger Service', () => {
  const logsDir = path.join(__dirname, '../logs');

  beforeAll(() => {
    // Asegurarse de que el directorio de logs existe
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Limpiar logs después de cada test si es necesario
    // (opcional, dependiendo de la estrategia de testing)
  });

  describe('Basic logging functions', () => {
    test('should log info messages', () => {
      expect(() => {
        logger.info('Test info message', { test: true });
      }).not.toThrow();
    });

    test('should log warning messages', () => {
      expect(() => {
        logger.warn('Test warning message', { test: true });
      }).not.toThrow();
    });

    test('should log error messages', () => {
      const testError = new Error('Test error');
      expect(() => {
        logger.error('Test error message', testError, { test: true });
      }).not.toThrow();
    });

    test('should log debug messages', () => {
      expect(() => {
        logger.debug('Test debug message', { test: true });
      }).not.toThrow();
    });
  });

  describe('Security logging', () => {
    test('should log login attempts', () => {
      expect(() => {
        logger.security.loginAttempt(
          'test@example.com',
          true,
          '127.0.0.1',
          'Mozilla/5.0'
        );
      }).not.toThrow();
    });

    test('should log successful logins', () => {
      expect(() => {
        logger.security.loginSuccess(
          'user123',
          'test@example.com',
          '127.0.0.1',
          'Mozilla/5.0'
        );
      }).not.toThrow();
    });

    test('should log failed logins', () => {
      expect(() => {
        logger.security.loginFailure(
          'test@example.com',
          'Invalid password',
          '127.0.0.1',
          'Mozilla/5.0'
        );
      }).not.toThrow();
    });

    test('should log suspicious activity', () => {
      expect(() => {
        logger.security.suspiciousActivity(
          'multiple_failed_logins',
          { attempts: 5, timeframe: '5min' },
          'user123',
          '127.0.0.1'
        );
      }).not.toThrow();
    });

    test('should log rate limit exceeded', () => {
      expect(() => {
        logger.security.rateLimitExceeded(
          '127.0.0.1',
          '/api/auth/login',
          10
        );
      }).not.toThrow();
    });

    test('should log validation errors', () => {
      expect(() => {
        logger.security.validationError(
          '/api/users',
          ['email is required', 'password too short'],
          '127.0.0.1',
          'user123'
        );
      }).not.toThrow();
    });
  });

  describe('Audit logging', () => {
    test('should log user actions', () => {
      expect(() => {
        logger.audit.userAction(
          'CREATE_RESERVATION',
          'user123',
          'reservation',
          'res456',
          { roomNumber: 101, dates: '2024-01-15 to 2024-01-18' }
        );
      }).not.toThrow();
    });

    test('should log data changes', () => {
      expect(() => {
        logger.audit.dataChange(
          'UPDATE',
          'rooms',
          'room123',
          { status: { old: 'disponible', new: 'ocupada' } },
          'user123'
        );
      }).not.toThrow();
    });

    test('should log system events', () => {
      expect(() => {
        logger.audit.systemEvent(
          'DATABASE_BACKUP_COMPLETED',
          { duration: '5min', size: '150MB' }
        );
      }).not.toThrow();
    });

    test('should log admin actions', () => {
      expect(() => {
        logger.audit.adminAction(
          'DELETE_USER',
          'admin123',
          'user456',
          { reason: 'Account violation' }
        );
      }).not.toThrow();
    });
  });

  describe('Performance logging', () => {
    test('should log request performance', () => {
      expect(() => {
        logger.performance.requestTime(
          'GET',
          '/api/reservations',
          250,
          200,
          'user123'
        );
      }).not.toThrow();
    });

    test('should log query performance', () => {
      expect(() => {
        logger.performance.queryTime(
          'db.reservations.find({status: "confirmed"})',
          150,
          'reservations'
        );
      }).not.toThrow();
    });

    test('should log slow operations', () => {
      expect(() => {
        logger.performance.slowOperation(
          'PDF_REPORT_GENERATION',
          5000,
          { reportType: 'monthly', pages: 50 }
        );
      }).not.toThrow();
    });
  });

  describe('WebSocket logging', () => {
    test('should log WebSocket connections', () => {
      expect(() => {
        logger.websocket.connection(
          'socket123',
          'user456',
          '127.0.0.1'
        );
      }).not.toThrow();
    });

    test('should log WebSocket disconnections', () => {
      expect(() => {
        logger.websocket.disconnection(
          'socket123',
          'client_disconnect'
        );
      }).not.toThrow();
    });

    test('should log WebSocket messages', () => {
      expect(() => {
        logger.websocket.message(
          'room_status_update',
          'socket123',
          'user456',
          { roomId: 'room101', status: 'ocupada' }
        );
      }).not.toThrow();
    });
  });

  describe('Error handling', () => {
    test('should handle null error objects gracefully', () => {
      expect(() => {
        logger.error('Error without error object', null, { context: 'test' });
      }).not.toThrow();
    });

    test('should handle errors without stack traces', () => {
      const errorWithoutStack = { message: 'Error message', name: 'CustomError' };
      expect(() => {
        logger.error('Custom error', errorWithoutStack, { context: 'test' });
      }).not.toThrow();
    });

    test('should handle undefined metadata', () => {
      expect(() => {
        logger.info('Message without metadata');
      }).not.toThrow();
    });
  });

  describe('Log file creation', () => {
    test('should create log directory if it does not exist', () => {
      expect(fs.existsSync(logsDir)).toBe(true);
    });

    // Note: These tests depend on the actual file system and may need to be adjusted
    // based on your testing environment and strategy
    test('should eventually create log files', (done) => {
      // Log something to trigger file creation
      logger.info('Test log for file creation');
      
      // Give Winston some time to write the file
      setTimeout(() => {
        const combinedLogExists = fs.existsSync(path.join(logsDir, 'combined.log'));
        expect(combinedLogExists).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Metadata handling', () => {
    test('should handle complex metadata objects', () => {
      const complexMeta = {
        user: { id: 123, email: 'test@example.com' },
        request: { method: 'POST', url: '/api/test' },
        nested: { level1: { level2: { value: 'deep' } } },
        array: [1, 2, 3],
        date: new Date(),
        null_value: null,
        undefined_value: undefined
      };

      expect(() => {
        logger.info('Complex metadata test', complexMeta);
      }).not.toThrow();
    });

    test('should handle circular reference objects safely', () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => {
        logger.info('Circular reference test', { circular: circularObj });
      }).not.toThrow();
    });
  });
});