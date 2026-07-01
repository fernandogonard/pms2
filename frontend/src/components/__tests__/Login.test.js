// components/__tests__/Login.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Login from '../../pages/Login';
import { useAuth } from '../../contexts/AuthContext';

const mockNavigate = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null })
}));

describe('Login page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      login: jest.fn().mockResolvedValue({ success: true }),
      isAuthenticated: false,
      error: null,
      clearError: jest.fn(),
      loading: false,
      user: null
    });
  });

  test('renderiza formulario básico', () => {
    render(<Login />);

    expect(screen.getByText(/iniciar sesión/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin@hotel.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  test('envía credenciales usando useAuth.login', async () => {
    const login = jest.fn().mockResolvedValue({ success: true });
    useAuth.mockReturnValue({
      login,
      isAuthenticated: false,
      error: null,
      clearError: jest.fn(),
      loading: false,
      user: null
    });

    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByPlaceholderText(/admin@hotel.com/i), 'admin@hotel.com');
    await user.type(screen.getByPlaceholderText(/••••••••/i), 'password123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'admin@hotel.com',
        password: 'password123'
      });
    });
  });

  test('redirige por rol cuando ya está autenticado', async () => {
    useAuth.mockReturnValue({
      login: jest.fn(),
      isAuthenticated: true,
      error: null,
      clearError: jest.fn(),
      loading: false,
      user: { role: 'admin' }
    });

    render(<Login />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });
});
