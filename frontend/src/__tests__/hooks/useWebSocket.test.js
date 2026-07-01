// __tests__/hooks/useWebSocket.test.js
// Tests unitarios para el hook useWebSocket
import { renderHook } from '@testing-library/react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { createWS } from '../../utils/wsClient';
import * as apiUtils from '../../utils/api';
import * as appMode from '../../config/appMode';

// Mock del cliente WebSocket
jest.mock('../../utils/wsClient');
jest.mock('../../utils/api');
jest.mock('../../config/appMode');

describe('useWebSocket', () => {
  let mockWsClient;
  let mockHandlers;

  beforeEach(() => {
    mockHandlers = {};
    mockWsClient = {
      close: jest.fn()
    };

    apiUtils.getAccessToken.mockReturnValue('token-test');
    appMode.getAppMode.mockReturnValue('production');
    
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
        onmessage: expect.any(Function),
        onclose: expect.any(Function),
        onerror: expect.any(Function)
      })
    );
  });

  test('should deliver parsed websocket messages', () => {
    const onMessage = jest.fn();
    
    renderHook(() => useWebSocket({
      onMessage
    }));

    const event = {
      data: JSON.stringify({ type: 'reservation_created', reservationId: '123' })
    };
    mockHandlers.onmessage(event);

    expect(onMessage).toHaveBeenCalledWith({ type: 'reservation_created', reservationId: '123' });
  });

  test('should handle errors', () => {
    const onError = jest.fn();
    renderHook(() => useWebSocket({ onMessage: jest.fn(), onError }));
    mockHandlers.onerror({ message: 'Test error' });
    expect(onError).toHaveBeenCalledWith('Test error');
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

    expect(onMessage).toHaveBeenCalledWith({ type: 'raw', data: 'invalid json' });
  });

  test('should ignore messages from another app mode', () => {
    const onMessage = jest.fn();
    
    renderHook(() => useWebSocket({
      onMessage
    }));

    const event = {
      data: JSON.stringify({ type: 'reservation_updated', mode: 'demo' })
    };
    mockHandlers.onmessage(event);

    expect(onMessage).not.toHaveBeenCalled();
  });
});
