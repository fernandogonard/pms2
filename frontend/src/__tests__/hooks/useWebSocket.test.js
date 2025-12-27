// __tests__/hooks/useWebSocket.test.js
// Tests unitarios para el hook useWebSocket
import { renderHook, waitFor } from '@testing-library/react';
import useWebSocket from '../../hooks/useWebSocket';
import { createWS } from '../../utils/wsClient';

// Mock del cliente WebSocket
jest.mock('../../utils/wsClient');
jest.mock('../../services/redirectorService', () => ({
  getWebSocketUrl: () => 'ws://localhost:5000/ws'
}));

describe('useWebSocket', () => {
  let mockWsClient;
  let mockHandlers;

  beforeEach(() => {
    mockHandlers = {};
    mockWsClient = {
      close: jest.fn()
    };
    
    createWS.mockImplementation((url, handlers) => {
      mockHandlers = handlers;
      return mockWsClient;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize WebSocket connection', () => {
    renderHook(() => useWebSocket({
      onMessage: jest.fn()
    }));

    expect(createWS).toHaveBeenCalledWith(
      expect.stringContaining('/ws'),
      expect.objectContaining({
        onopen: expect.any(Function),
        onmessage: expect.any(Function),
        onclose: expect.any(Function),
        onerror: expect.any(Function)
      })
    );
  });

  test('should deduplicate messages within window', async () => {
    const onMessage = jest.fn(() => true);
    
    renderHook(() => useWebSocket({
      onMessage,
      dedupeWindow: 500
    }));

    // Simular primer mensaje
    const event1 = {
      data: JSON.stringify({ type: 'reservation_created', reservationId: '123' })
    };
    mockHandlers.onmessage(event1);

    expect(onMessage).toHaveBeenCalledTimes(1);

    // Simular mensaje duplicado inmediato
    const event2 = {
      data: JSON.stringify({ type: 'reservation_created', reservationId: '123' })
    };
    mockHandlers.onmessage(event2);

    // No debe llamar de nuevo (deduplicado)
    expect(onMessage).toHaveBeenCalledTimes(1);

    // Esperar que pase la ventana de deduplicación
    await waitFor(() => new Promise(resolve => setTimeout(resolve, 600)));

    // Ahora sí debe procesar
    mockHandlers.onmessage(event2);
    expect(onMessage).toHaveBeenCalledTimes(2);
  });

  test('should update connection state on open/close', () => {
    const { result } = renderHook(() => useWebSocket({
      onMessage: jest.fn()
    }));

    expect(result.current.isConnected).toBe(false);

    // Simular apertura
    mockHandlers.onopen({});
    
    expect(result.current.isConnected).toBe(true);
    expect(result.current.wsError).toBe(null);

    // Simular cierre
    mockHandlers.onclose({});
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.wsError).toBe('Conexión cerrada');
  });

  test('should handle errors', () => {
    const { result } = renderHook(() => useWebSocket({
      onMessage: jest.fn()
    }));

    mockHandlers.onerror({ message: 'Test error' });

    expect(result.current.wsError).toBe('Error en WebSocket');
    expect(result.current.isConnected).toBe(false);
  });

  test('should close connection on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket({
      onMessage: jest.fn()
    }));

    unmount();

    expect(mockWsClient.close).toHaveBeenCalled();
  });

  test('should ignore invalid JSON messages', () => {
    const onMessage = jest.fn();
    
    renderHook(() => useWebSocket({
      onMessage
    }));

    const event = {
      data: 'invalid json'
    };
    mockHandlers.onmessage(event);

    expect(onMessage).not.toHaveBeenCalled();
  });

  test('should warn on unconsumed reservation events', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const onMessage = jest.fn(() => false); // No consume el evento
    
    renderHook(() => useWebSocket({
      onMessage
    }));

    const event = {
      data: JSON.stringify({ type: 'reservation_updated' })
    };
    mockHandlers.onmessage(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[useWebSocket] Evento no consumido:',
      'reservation_updated'
    );

    consoleSpy.mockRestore();
  });
});
