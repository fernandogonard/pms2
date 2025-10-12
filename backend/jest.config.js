// jest.config.js
// Configuración Jest enterprise para testing completo

module.exports = {
  // Entorno de testing
  testEnvironment: 'node',
  
  // Cobertura de código
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    'controllers/**/*.js',
    'models/**/*.js',
    'services/**/*.js',
    'middlewares/**/*.js',
    'utils/**/*.js',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary', 
    'html',
    'lcov',
    'cobertura'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Configuración de pruebas
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/'
  ],

  // Setup y teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Transformaciones
  transform: {},

  // Configuración adicional
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Timeouts
  testTimeout: 30000,

  // Reporters básicos
  reporters: ['default']
};