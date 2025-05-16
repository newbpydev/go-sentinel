// These are available globally from the test runner
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

  beforeEach(function() {
    // Store the original WebSocket
    originalWebSocket = window.WebSocket;
    
    // Create a mock WebSocket
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        this.binaryType = '';
        this.bufferedAmount = 0;
        this.extensions = '';
        this.protocol = '';
        this.readyState = WebSocket.CONNECTING;
        
        // Add WebSocket constants if they don't exist
        if (!('CONNECTING' in this.constructor)) {
          this.constructor.CONNECTING = 0;
          this.constructor.OPEN = 1;
          this.constructor.CLOSING = 2;
          this.constructor.CLOSED = 3;
        }
        
        this.send = sinon.spy();
        this.close = sinon.spy((code, reason) => {
          this.readyState = this.constructor.CLOSED;
          if (this.onclose) {
            this.onclose({ 
              wasClean: true, 
              code: code || 1000, 
              reason: reason || '',
              target: this
            });
          }
        });
      }
    }
    
    // Set the mock WebSocket
    window.WebSocket = MockWebSocket;

    // Create mock handlers with sinon spies
    mockHandlers = {
      onConnect: sinon.spy(),
      onDisconnect: sinon.spy(),
      onTestResults: sinon.spy(),
      onMetricsUpdate: sinon.spy(),
      onNotification: sinon.spy(),
      onError: sinon.spy(),
    };

    // Create a new client instance
    client = new WebSocketClient('ws://localhost:8080/ws', mockHandlers);
    mockWebSocket = client.socket;
  });

  afterEach((done) => {
    // Clean up the client if it exists
    if (client) {
      // Clean up any timers
      if (client.reconnectTimeout) {
        clearTimeout(client.reconnectTimeout);
        client.reconnectTimeout = null;
      }
      
      // Close the connection if it's open
      if (client.socket) {
        // Wait for the close event to be processed
        const originalOnClose = client.socket.onclose;
        client.socket.onclose = function() {
          if (originalOnClose) originalOnClose.call(this);
          finishCleanup();
        };
        client.socket.close();
        client.socket = null;
      } else {
        finishCleanup();
      }
    } else {
      finishCleanup();
    }
    
    function finishCleanup() {
      // Restore the original WebSocket
      window.WebSocket = originalWebSocket;
      
      // Reset all spies
      if (window.sinon) {
        window.sinon.restore();
      }
      
      // Reset client reference
      client = null;
      mockWebSocket = null;
      mockHandlers = null;
      
      done();
    }
  });

  it('connects to the correct URL', function() {
    expect(mockWebSocket.url).to.equal('ws://localhost:8080/ws');
  });

  it('calls onConnect when connection is established', function() {
    // Simulate successful connection
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    expect(mockHandlers.onConnect).to.have.been.called.once;
    expect(client.isConnected).to.be.true;
  });

  it('calls onDisconnect when connection is closed', function() {
    // Simulate successful connection first
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Now close the connection
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockWebSocket.onclose({ wasClean: true, code: 1000 });
    
    expect(mockHandlers.onDisconnect).to.have.been.called.once;
    expect(client.isConnected).to.be.false;
  });

  it('calls onError when connection error occurs', function() {
    const errorEvent = { type: 'error', message: 'Test error' };
    mockWebSocket.onerror(errorEvent);
    
    expect(mockHandlers.onError).to.have.been.called.once;
    expect(mockHandlers.onError).to.have.been.calledWith(sinon.match(errorEvent));
  });

  it('processes test_results message correctly', function() {
    const testData = [{ name: 'TestExample', status: 'passed', duration: '100ms' }];
    const messageEvent = {
      data: JSON.stringify({
        type: 'test_results',
        payload: testData
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onTestResults).to.have.been.called.once;
    expect(mockHandlers.onTestResults).to.have.been.calledWith(testData);
  });

  it('processes metrics_update message correctly', function() {
    const metrics = { testsRun: 10, testsPassed: 9, coverage: 90 };
    const messageEvent = {
      data: JSON.stringify({
        type: 'metrics_update',
        payload: metrics
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onMetricsUpdate).to.have.been.called.once;
    expect(mockHandlers.onMetricsUpdate).to.have.been.calledWith(metrics);
  });

  it('processes notification message correctly', function() {
    const notification = { type: 'info', message: 'Test notification' };
    const messageEvent = {
      data: JSON.stringify({
        type: 'notification',
        payload: notification
      })
    };
    
    mockWebSocket.onmessage(messageEvent);
    expect(mockHandlers.onNotification).to.have.been.called.once;
    expect(mockHandlers.onNotification).to.have.been.calledWith(notification);
  });

  it('handles non-JSON messages gracefully', function() {
    const messageEvent = { data: 'not-a-json' };
    
    // Mock console.error to verify it's called
    const originalError = console.error;
    console.error = sinon.spy();
    
    mockWebSocket.onmessage(messageEvent);
    
    expect(console.error).to.have.been.called.once;
    expect(console.error).to.have.been.calledWith('Error parsing WebSocket message:', sinon.match.instanceOf(Error));
    
    // Restore console.error
    console.error = originalError;
  });

  it('handles invalid message types gracefully', function() {
    const messageEvent = {
      data: JSON.stringify({
        type: 'invalid_type',
        payload: {}
      })
    };
    
    // Mock console.warn to verify it's called
    const originalWarn = console.warn;
    console.warn = sinon.spy();
    
    mockWebSocket.onmessage(messageEvent);
    
    expect(console.warn).to.have.been.called.once;
    expect(console.warn).to.have.been.calledWith('Unknown message type:', 'invalid_type');
    
    // Restore console.warn
    console.warn = originalWarn;
  });

  it('attempts to reconnect when connection is lost', function(done) {
    this.timeout(5000); // Increase timeout for this test
    
    // Set up the initial connection
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Store the original reconnect method
    const originalReconnect = client.reconnect;
    client.reconnect = sinon.spy(originalReconnect);
    
    // Simulate connection close
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockWebSocket.onclose({ wasClean: false, code: 1006 });
    
    // Verify onDisconnect was called
    expect(mockHandlers.onDisconnect).to.have.been.called.once;
    
    // Wait for the reconnect attempt
    setTimeout(() => {
      try {
        expect(client.reconnect).to.have.been.called;
        done();
      } catch (err) {
        done(err);
      }
    }, client.reconnectDelay + 100);
  });

  it('stops reconnecting after max attempts', function(done) {
    this.timeout(10000); // Increase timeout for this test
    
    // Set a smaller max attempts for testing
    client.maxReconnectAttempts = 2;
    
    // Set up the initial connection
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Store the original reconnect method
    const originalReconnect = client.reconnect;
    client.reconnect = function() {
      originalReconnect.call(client);
      // After each reconnect attempt, simulate another close
      if (client.reconnectAttempts <= client.maxReconnectAttempts) {
        mockWebSocket.readyState = WebSocket.CLOSED;
        mockWebSocket.onclose({ wasClean: false, code: 1006 });
      }
    };
    
    // Simulate initial connection close
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockWebSocket.onclose({ wasClean: false, code: 1006 });
    
    // Wait for all reconnect attempts
    setTimeout(() => {
      try {
        // The client should have given up reconnecting
        expect(client.reconnectAttempts).to.be.greaterThanOrEqual(client.maxReconnectAttempts);
        done();
      } catch (err) {
        done(err);
      }
    }, (client.reconnectDelay * (client.maxReconnectAttempts + 1)) + 200);
  });

  it('sends messages when connected', function() {
    // First connect
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    const testMessage = { type: 'test', data: 'test data' };
    client.send('test_message', testMessage);
    
    expect(mockWebSocket.send).to.have.been.called.once;
    const sentData = JSON.parse(mockWebSocket.send.getCall(0).args[0]);
    expect(sentData.type).to.equal('test_message');
    expect(sentData.payload).to.deep.equal(testMessage);
  });
  
  it('does not send messages when not connected', function() {
    // Don't connect
    mockWebSocket.readyState = WebSocket.CLOSED;
    
    const testMessage = { type: 'test', data: 'test data' };
    client.send('test_message', testMessage);
    
    expect(mockWebSocket.send).to.not.have.been.called;
  });
  
  it('closes connection properly', function() {
    // First connect
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Then close
    client.close();
    
    expect(mockWebSocket.close).to.have.been.called.once;
    expect(client.isConnected).to.be.false;
    expect(client.socket).to.be.null;
  });
  
  it('handles connection errors', function() {
    const error = new Error('Connection failed');
    mockWebSocket.onerror(error);
    
    expect(mockHandlers.onError).to.have.been.called.once;
    expect(mockHandlers.onError).to.have.been.calledWith(error);
  });
  
  it('handles connection close with error code', function() {
    // First connect
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Close with error code
    const closeEvent = { wasClean: false, code: 1006, reason: 'Connection failed' };
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockWebSocket.onclose(closeEvent);
    
    expect(mockHandlers.onDisconnect).to.have.been.called.once;
    expect(mockHandlers.onError).to.have.been.called;
  });
});
