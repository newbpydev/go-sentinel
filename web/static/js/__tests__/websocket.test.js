import { WebSocketClient } from '../websocket.js';

describe('WebSocketClient', () => {
  let mockWebSocket;
  let client;
  let mockHandlers;
  let originalWebSocket;

  // Mock WebSocket implementation
  class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      this.readyState = WebSocket.CONNECTING;
      this.send = jest.fn();
      this.close = jest.fn().mockImplementation(() => {
        if (this.onclose) this.onclose();
      });
    }
  }

  beforeEach(() => {
    // Store the original WebSocket and replace with our mock
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;

    // Create mock handlers
    mockHandlers = {
      onConnect: jest.fn(),
      onDisconnect: jest.fn(),
      onTestResults: jest.fn(),
      onMetricsUpdate: jest.fn(),
      onNotification: jest.fn(),
      onError: jest.fn(),
    };

    // Create a new client instance
    client = new WebSocketClient('ws://localhost:8080/ws', mockHandlers);
    mockWebSocket = client.socket;
  });

  afterEach(() => {
    // Restore the original WebSocket
    global.WebSocket = originalWebSocket;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('connects to the correct URL', () => {
    expect(mockWebSocket.url).toBe('ws://localhost:8080/ws');
  });

  test('calls onConnect when connection is established', () => {
    mockWebSocket.onopen();
    expect(mockHandlers.onConnect).toHaveBeenCalled();
    expect(client.isConnected).toBe(true);
  });

  test('calls onDisconnect when connection is closed', () => {
    mockWebSocket.onopen(); // Simulate connection first
    mockWebSocket.onclose();
    expect(mockHandlers.onDisconnect).toHaveBeenCalled();
    expect(client.isConnected).toBe(false);
  });

  test('calls onError when connection error occurs', () => {
    const errorEvent = { type: 'error' };
    mockWebSocket.onerror(errorEvent);
    expect(mockHandlers.onError).toHaveBeenCalledWith(errorEvent);
  });

  test('processes test_results message correctly', () => {
    const testData = [{ name: 'TestExample', status: 'passed', duration: '100ms' }];
    const messageEvent = {
      data: JSON.stringify({
        type: 'test_results',
        payload: testData
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onTestResults).toHaveBeenCalledWith(testData);
  });

  test('processes metrics_update message correctly', () => {
    const metrics = { testsRun: 10, testsPassed: 9, coverage: 90 };
    const messageEvent = {
      data: JSON.stringify({
        type: 'metrics-update',
        payload: metrics
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onMetricsUpdate).toHaveBeenCalledWith(metrics);
  });

  test('processes notification message correctly', () => {
    const notification = { type: 'info', title: 'Test', message: 'Test message' };
    const messageEvent = {
      data: JSON.stringify({
        type: 'notification',
        payload: notification
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onNotification).toHaveBeenCalledWith(notification);
  });

  test('ignores unknown message types', () => {
    const messageEvent = {
      data: JSON.stringify({
        type: 'unknown_type',
        payload: {}
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    // None of the handlers should be called for unknown message types
    expect(mockHandlers.onTestResults).not.toHaveBeenCalled();
    expect(mockHandlers.onMetricsUpdate).not.toHaveBeenCalled();
    expect(mockHandlers.onNotification).not.toHaveBeenCalled();
  });

  test('handles malformed JSON messages', () => {
    const originalError = console.error;
    console.error = jest.fn();
    
    const messageEvent = { data: 'not a valid JSON' };
    mockWebSocket.onmessage(messageEvent);
    
    expect(console.error).toHaveBeenCalled();
    expect(mockHandlers.onError).toHaveBeenCalled();
    
    console.error = originalError;
  });

  test('reconnects when connection is lost', () => {
    jest.useFakeTimers();
    
    // Simulate connection close
    mockWebSocket.onclose();
    
    // Fast-forward past the reconnection delay
    jest.advanceTimersByTime(3000);
    
    // Should have created a new WebSocket instance
    expect(mockWebSocket.close).toHaveBeenCalled();
    expect(WebSocket).toHaveBeenCalledTimes(2); // Initial + reconnection
    
    jest.useRealTimers();
  });

  test('sends messages correctly', () => {
    mockWebSocket.onopen(); // Simulate connection
    const testPayload = { key: 'value' };
    
    client.send('test_message', testPayload);
    
    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'test_message',
        payload: testPayload
      })
    );
  });

  test('does not send message when not connected', () => {
    // Don't simulate connection open
    client.send('test_message', {});
    expect(mockWebSocket.send).not.toHaveBeenCalled();
  });

  test('closes connection properly', () => {
    client.close();
    expect(mockWebSocket.close).toHaveBeenCalled();
    expect(client.isConnected).toBe(false);
  });
});
