import { WebSocketClient } from '../websocket.js';

// Export init function for the test runner
export async function init() {
  // Any async setup can go here
  return Promise.resolve();
}

describe('WebSocketClient', () => {
  let mockWebSocket;
  let client;
  let mockHandlers;
  let originalWebSocket;

  beforeEach(() => {
    // Store the original WebSocket
    originalWebSocket = global.WebSocket;
    
    // Create a mock WebSocket
    global.WebSocket = class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        this.readyState = WebSocket.CONNECTING;
        this.send = chai.spy();
        this.close = chai.spy(() => {
          if (this.onclose) this.onclose();
        });
      }
    };

    // Create mock handlers with sinon spies
    mockHandlers = {
      onConnect: chai.spy(),
      onDisconnect: chai.spy(),
      onTestResults: chai.spy(),
      onMetricsUpdate: chai.spy(),
      onNotification: chai.spy(),
      onError: chai.spy(),
    };

    // Create a new client instance
    client = new WebSocketClient('ws://localhost:8080/ws', mockHandlers);
    mockWebSocket = client.socket;
  });

  afterEach(() => {
    // Restore the original WebSocket
    global.WebSocket = originalWebSocket;
    
    // Clean up any timers
    if (client.reconnectTimeout) {
      clearTimeout(client.reconnectTimeout);
    }
  });

  it('connects to the correct URL', () => {
    expect(mockWebSocket.url).to.equal('ws://localhost:8080/ws');
  });

  it('calls onConnect when connection is established', () => {
    mockWebSocket.onopen();
    expect(mockHandlers.onConnect).to.have.been.called.once;
    expect(client.isConnected).to.be.true;
  });

  it('calls onDisconnect when connection is closed', () => {
    mockWebSocket.onopen(); // Simulate connection first
    mockWebSocket.onclose();
    expect(mockHandlers.onDisconnect).to.have.been.called.once;
    expect(client.isConnected).to.be.false;
  });

  it('calls onError when connection error occurs', () => {
    const errorEvent = { type: 'error' };
    mockWebSocket.onerror(errorEvent);
    expect(mockHandlers.onError).to.have.been.called.once;
    expect(mockHandlers.onError).to.have.been.called.with(errorEvent);
  });

  it('processes test_results message correctly', () => {
    const testData = [{ name: 'TestExample', status: 'passed', duration: '100ms' }];
    const messageEvent = {
      data: JSON.stringify({
        type: 'test_results',
        payload: testData
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onTestResults).to.have.been.called.once;
    expect(mockHandlers.onTestResults).to.have.been.called.with(testData);
  });

  it('processes metrics_update message correctly', () => {
    const metrics = { testsRun: 10, testsPassed: 9, coverage: 90 };
    const messageEvent = {
      data: JSON.stringify({
        type: 'metrics-update',
        payload: metrics
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onMetricsUpdate).to.have.been.called.once;
    expect(mockHandlers.onMetricsUpdate).to.have.been.called.with(metrics);
  });

  it('processes notification message correctly', () => {
    const notification = { type: 'info', title: 'Test', message: 'Test message' };
    const messageEvent = {
      data: JSON.stringify({
        type: 'notification',
        payload: notification
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onNotification).to.have.been.called.once;
    expect(mockHandlers.onNotification).to.have.been.called.with(notification);
  });

  it('ignores unknown message types', () => {
    const messageEvent = {
      data: JSON.stringify({
        type: 'unknown_type',
        payload: {}
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    // None of the handlers should be called for unknown message types
    expect(mockHandlers.onTestResults).to.not.have.been.called;
    expect(mockHandlers.onMetricsUpdate).to.not.have.been.called;
    expect(mockHandlers.onNotification).to.not.have.been.called;
  });

  it('handles malformed JSON messages', () => {
    const messageEvent = { data: 'not a valid JSON' };
    
    // Spy on console.error
    const consoleError = console.error;
    const errorSpy = chai.spy();
    console.error = errorSpy;
    
    mockWebSocket.onmessage(messageEvent);
    expect(errorSpy).to.have.been.called.once;
    
    // Restore console.error
    console.error = consoleError;
  });

  it('reconnects when connection is lost', (done) => {
    // Simulate connection close
    mockWebSocket.onclose();
    
    // Wait for reconnection attempt
    setTimeout(() => {
      try {
        expect(mockWebSocket.close).to.have.been.called.once;
        // Should have created a new WebSocket instance
        expect(WebSocket).to.have.been.called.twice; // Initial + reconnection
        done();
      } catch (error) {
        done(error);
      }
    }, 100);
  });

  it('sends messages correctly', () => {
    mockWebSocket.onopen(); // Simulate connection
    const testPayload = { key: 'value' };
    
    client.send('test_message', testPayload);
    
    expect(mockWebSocket.send).to.have.been.called.once;
    expect(mockWebSocket.send).to.have.been.called.with(
      JSON.stringify({
        type: 'test_message',
        payload: testPayload
      })
    );
  });

  it('does not send message when not connected', () => {
    // Don't simulate connection open
    client.send('test_message', {});
    expect(mockWebSocket.send).to.not.have.been.called;
  });

  it('closes connection properly', () => {
    client.close();
    expect(mockWebSocket.close).to.have.been.called.once;
    expect(client.isConnected).to.be.false;
  });
});
