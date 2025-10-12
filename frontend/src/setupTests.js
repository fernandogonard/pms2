// frontend/src/setupTests.js
// Configuración global para React Testing Library

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfills para Node.js
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock de window.matchMedia (necesario para componentes que usan media queries)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock de ResizeObserver (necesario para algunos componentes)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock de IntersectionObserver (para lazy loading)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock de window.scrollTo
global.scrollTo = jest.fn();

// Mock de localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock de sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock de fetch (para requests HTTP)
global.fetch = jest.fn();

// Mock de console.error para tests más limpios
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Configuración de timeout para tests async
jest.setTimeout(30000);

// Mock de WebSocket para tests de tiempo real
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock de URL.createObjectURL (para tests de archivos)
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Mock de FileReader (para tests de carga de archivos)
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsDataURL: jest.fn(),
  readAsText: jest.fn(),
  result: '',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Configuración para Crypto API (necesario para algunos tests de seguridad)
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn().mockReturnValue(new Uint32Array(10)),
    randomUUID: jest.fn().mockReturnValue('test-uuid'),
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
});

// Helper para limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Configuración de custom matchers personalizados
expect.extend({
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
  
  toHaveValidCSSClass(received, className) {
    const element = received;
    const pass = element.classList.contains(className);
    
    if (pass) {
      return {
        message: () => `expected element not to have CSS class ${className}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to have CSS class ${className}`,
        pass: false,
      };
    }
  },
});

// Mock de react-router-dom por defecto
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
  }),
  useParams: () => ({}),
}));

// Configuración global para tests de componentes con contexto
export const createMockAuthContext = (overrides = {}) => ({
  user: null,
  token: null,
  login: jest.fn(),
  logout: jest.fn(),
  isAuthenticated: false,
  loading: false,
  ...overrides,
});

// Helper para tests de formularios
export const fillForm = async (user, formData) => {
  for (const [field, value] of Object.entries(formData)) {
    const input = screen.getByLabelText(new RegExp(field, 'i'));
    await user.clear(input);
    await user.type(input, value);
  }
};

// Helper para tests de API
export const mockApiResponse = (endpoint, response, status = 200) => {
  fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(response),
    text: jest.fn().mockResolvedValue(JSON.stringify(response)),
  });
};

// Helper para tests de errores
export const expectErrorMessage = async (expectedMessage) => {
  await waitFor(() => {
    expect(screen.getByText(new RegExp(expectedMessage, 'i'))).toBeInTheDocument();
  });
};

// Importar utilities necesarias para otros tests
import { screen, waitFor } from '@testing-library/react';

// Configuración para tests de performance
if (process.env.NODE_ENV === 'test') {
  // Configurar métricas de rendimiento para tests
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  };
}