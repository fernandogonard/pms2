// frontend/src/components/__tests__/Login.test.js
// Tests unitarios para el componente Login

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Login from '../pages/Login';
import { AuthProvider } from '../contexts/AuthContext';

// Mock de react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock de la API
jest.mock('../utils/api', () => ({
  login: jest.fn(),
}));

const api = require('../utils/api');

// Wrapper para proveer contexto necesario
const LoginWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
  });

  const renderLogin = () => {
    return render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );
  };

  describe('Rendering', () => {
    it('should render login form elements', () => {
      renderLogin();

      expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
    });

    it('should render hotel branding', () => {
      renderLogin();

      expect(screen.getByText(/hotel paradise/i)).toBeInTheDocument();
      expect(screen.getByText(/sistema de gestión hotelera/i)).toBeInTheDocument();
    });

    it('should render form with correct initial state', () => {
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup();
      renderLogin();

      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/el email es requerido/i)).toBeInTheDocument();
        expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/formato de email inválido/i)).toBeInTheDocument();
      });
    });

    it('should validate minimum password length', async () => {
      const user = userEvent.setup();
      renderLogin();

      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(passwordInput, '123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/la contraseña debe tener al menos 6 caracteres/i)).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user starts typing', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      // Generar error de validación
      await user.click(submitButton);
      await waitFor(() => {
        expect(screen.getByText(/el email es requerido/i)).toBeInTheDocument();
      });

      // Empezar a escribir debería limpiar el error
      await user.type(emailInput, 'test@example.com');
      await waitFor(() => {
        expect(screen.queryByText(/el email es requerido/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid credentials', async () => {
      const user = userEvent.setup();
      api.login.mockResolvedValue({
        success: true,
        token: 'mock-token',
        user: { id: 1, email: 'test@example.com', role: 'admin' }
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      api.login.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      expect(screen.getByText(/iniciando sesión.../i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should handle login success and redirect', async () => {
      const user = userEvent.setup();
      api.login.mockResolvedValue({
        success: true,
        token: 'mock-token',
        user: { id: 1, email: 'test@example.com', role: 'admin' }
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });

    it('should handle login failure and show error', async () => {
      const user = userEvent.setup();
      api.login.mockResolvedValue({
        success: false,
        message: 'Credenciales inválidas'
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
      });

      expect(submitButton).not.toBeDisabled();
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();
      api.login.mockRejectedValue(new Error('Network Error'));

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/error de conexión/i)).toBeInTheDocument();
      });
    });
  });

  describe('Role-based Redirection', () => {
    it('should redirect admin users to admin dashboard', async () => {
      const user = userEvent.setup();
      api.login.mockResolvedValue({
        success: true,
        token: 'mock-token',
        user: { id: 1, email: 'admin@test.com', role: 'admin' }
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'admin@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });

    it('should redirect reception users to reception dashboard', async () => {
      const user = userEvent.setup();
      api.login.mockResolvedValue({
        success: true,
        token: 'mock-token',
        user: { id: 1, email: 'reception@test.com', role: 'recepcion' }
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'reception@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/reception');
      });
    });

    it('should redirect client users to public home', async () => {
      const user = userEvent.setup();
      api.login.mockResolvedValue({
        success: true,
        token: 'mock-token',
        user: { id: 1, email: 'client@test.com', role: 'cliente' }
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'client@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and aria attributes', () => {
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('required');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      // Tab navigation
      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should have proper heading hierarchy', () => {
      renderLogin();

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();
    });
  });

  describe('Security Features', () => {
    it('should not expose sensitive data in DOM', () => {
      renderLogin();

      // Verificar que no hay tokens o datos sensibles expuestos
      expect(document.body.innerHTML).not.toContain('token');
      expect(document.body.innerHTML).not.toContain('password');
    });

    it('should handle XSS attempts safely', async () => {
      const user = userEvent.setup();
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const maliciousScript = '<script>alert("xss")</script>';

      await user.type(emailInput, maliciousScript);

      // El valor debería ser el texto plano, no ejecutado como script
      expect(emailInput).toHaveValue(maliciousScript);
      expect(document.body.innerHTML).not.toContain('<script>');
    });
  });
});