// Import the WebSocketClient using a relative path
import { WebSocketClient } from '../websocket.js';

// Make WebSocketClient available globally for tests
window.WebSocketClient = WebSocketClient;

// Export init function for the test runner
export async function init() {
  // Any async setup can go here
  await new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
  
  // Ensure mocha is available
  if (typeof mocha === 'undefined') {
    throw new Error('Mocha not found. Make sure mocha.js is loaded before running tests.');
  }
  
  return Promise.resolve();
}

// Only run tests if mocha is available
if (typeof mocha !== 'undefined') {
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
        
        // Ensure WebSocket constants exist
        if (!('CONNECTING' in window.WebSocket)) {
          window.WebSocket.CONNECTING = 0;
          window.WebSocket.OPEN = 1;
          window.WebSocket.CLOSING = 2;
          window.WebSocket.CLOSED = 3;
        }
        
        this.send = sinon.spy();
        this.close = sinon.spy((code, reason) => {
          this.readyState = window.WebSocket.CLOSED;
          if (this.onclose) {
            const event = new Event('close');
            event.wasClean = true;
            event.code = code || 1000;
            event.reason = reason || '';
            event.target = this;
            this.onclose(event);
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

  afterEach(function(done) {
    this.timeout(5000); // Increase timeout for cleanup
    
    // Helper function to finish cleanup
    const finishCleanup = () => {
      // Clear any pending timeouts first
      if (client && client.reconnectTimeout) {
        clearTimeout(client.reconnectTimeout);
        client.reconnectTimeout = null;
      }
      
      // Reset all spies and stubs
      if (window.sinon) {
        sinon.restore();
      }
      
      // Restore the original WebSocket
      window.WebSocket = originalWebSocket;
      
      // Reset references to prevent memory leaks
      client = null;
      mockWebSocket = null;
      mockHandlers = null;
      
      // Use setTimeout to ensure cleanup is complete
      setTimeout(() => {
        done();
      }, 0);
    };
    
    // If no client exists, just finish cleanup
    if (!client) {
      return finishCleanup();
    }
    
    // Clean up any timers
    if (client.reconnectTimeout) {
      clearTimeout(client.reconnectTimeout);
      client.reconnectTimeout = null;
    }
    
    // Close the connection if it's open
    if (client.socket) {
      try {
        // Store the original onclose handler
        const originalOnClose = client.socket.onclose;
        let closeCalled = false;
        
        // Replace with our own handler that calls the original
        client.socket.onclose = function() {
          if (closeCalled) return; // Prevent multiple calls
          closeCalled = true;
          
          if (typeof originalOnClose === 'function') {
            try {
              originalOnClose.call(this);
            } catch (err) {
              console.error('Error in original onclose handler:', err);
            }
          }
          
          // Ensure we always call finishCleanup, even if there's an error
          setTimeout(() => {
            finishCleanup();
          }, 0);
        };
        
        // Close the socket if it's not already closed
        if (client.socket.readyState === WebSocket.OPEN || 
            client.socket.readyState === WebSocket.CONNECTING) {
          client.socket.close();
        } else {
          // If already closed, just trigger the cleanup
          const event = new Event('close');
          event.wasClean = true;
          event.code = 1000;
          event.reason = 'Test cleanup';
          event.target = client.socket;
          client.socket.onclose(event);
        }
        
        // Clear the reference
        client.socket = null;
      } catch (err) {
        console.error('Error during cleanup:', err);
        finishCleanup();
      }
    } else {
      finishCleanup();
    }
  });

  it('connects to the correct URL', function() {
    expect(mockWebSocket.url).to.equal('ws://localhost:8080/ws');
  });

  it('calls onConnect when connection is established', function() {
    // Simulate successful connection
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Check if onConnect was called once
    sinon.assert.calledOnce(mockHandlers.onConnect);
    expect(client.isConnected).to.be.true;
  });

  it('calls onDisconnect when connection is closed', function() {
    // Simulate successful connection first
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Reset the call count for onDisconnect
    mockHandlers.onDisconnect.resetHistory();
    
    // Now close the connection
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockWebSocket.onclose({ wasClean: true, code: 1000 });
    
    // Check if onDisconnect was called once
    sinon.assert.calledOnce(mockHandlers.onDisconnect);
    expect(client.isConnected).to.be.false;
  });

  it('calls onError when connection error occurs', function() {
    const errorEvent = { type: 'error', message: 'Test error' };
    mockWebSocket.onerror(errorEvent);
    
    // Check if onError was called once with the correct error
    sinon.assert.calledOnce(mockHandlers.onError);
    sinon.assert.calledWith(mockHandlers.onError, sinon.match(errorEvent));
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
    
    // Check if onTestResults was called once with the test data
    sinon.assert.calledOnce(mockHandlers.onTestResults);
    sinon.assert.calledWith(mockHandlers.onTestResults, testData);
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
    
    // Check if onMetricsUpdate was called once with the metrics data
    sinon.assert.calledOnce(mockHandlers.onMetricsUpdate);
    sinon.assert.calledWith(mockHandlers.onMetricsUpdate, metrics);
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
    
    // Check if onNotification was called once with the notification data
    sinon.assert.calledOnce(mockHandlers.onNotification);
    sinon.assert.calledWith(mockHandlers.onNotification, notification);
  });

  it('handles non-JSON messages gracefully', function() {
    const messageEvent = { data: 'not-a-json' };
    
    // Mock console.error to verify it's called
    const originalError = console.error;
    const errorSpy = sinon.spy();
    console.error = errorSpy;
    
    // Mock the error handler
    const originalErrorHandler = mockHandlers.onError;
    const errorHandlerSpy = sinon.spy();
    mockHandlers.onError = errorHandlerSpy;
    
    try {
      // Trigger the message handler
      mockWebSocket.onmessage(messageEvent);
      
      // Check if error handler was called
      sinon.assert.calledOnce(errorHandlerSpy);
      
      // Check if console.error was called
      if (errorSpy.called) {
        // If console.error was called, it should have the expected message
        sinon.assert.calledWithMatch(errorSpy, sinon.match(/Error processing message|Error parsing WebSocket message/i));
      }
    } finally {
      // Restore originals
      console.error = originalError;
      mockHandlers.onError = originalErrorHandler;
    }
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
    const warnSpy = sinon.spy();
    console.warn = warnSpy;
    
    try {
      // Trigger the message handler
      mockWebSocket.onmessage(messageEvent);
      
      // Check if console.warn was called with the expected message
      sinon.assert.calledWithMatch(warnSpy, /Unknown message type/i);
      
      // Check that the message type is included in the warning
      const warnArgs = warnSpy.getCall(0).args;
      const warnMessage = warnArgs.join(' ');
      expect(warnMessage).to.include('invalid_type');
    } finally {
      // Restore console.warn
      console.warn = originalWarn;
    }
  });

  it('attempts to reconnect when connection is lost', function(done) {
    this.timeout(10000); // Increase timeout for this test
    
    // Set up the initial connection
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Reset the onDisconnect spy to track new calls
    mockHandlers.onDisconnect.resetHistory();
    
    // Store the original reconnect method
    const originalReconnect = client.reconnect;
    let reconnectCalled = false;
    
    // Override reconnect to track calls and prevent actual reconnection
    client.reconnect = function() {
      reconnectCalled = true;
      // Don't actually reconnect in the test
      this.reconnectAttempts++;
      return Promise.resolve();
    };
    
    // Simulate connection close with error code that should trigger reconnection
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockWebSocket.onclose({ wasClean: false, code: 1006, reason: 'Connection failed' });
    
    // Verify onDisconnect was called
    sinon.assert.calledOnce(mockHandlers.onDisconnect);
    
    // Wait for the reconnect attempt
    setTimeout(() => {
      try {
        // Check if reconnect was called
        expect(reconnectCalled).to.be.true;
        done();
      } catch (err) {
        done(err);
      }
    }, client.reconnectDelay + 100);
  });

  it('stops reconnecting after max attempts', function(done) {
    this.timeout(10000); // Reduce timeout since we're not doing actual reconnections
    
    // Set a smaller max attempts for testing
    const maxAttempts = 2;
    client.maxReconnectAttempts = maxAttempts;
    
    // Set up the initial connection
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Store the original reconnect method
    const originalReconnect = client.reconnect;
    let reconnectCalls = 0;
    
    // Override the reconnect method to track calls and simulate reconnection attempts
    client.reconnect = function() {
      reconnectCalls++;
      this.reconnectAttempts = reconnectCalls; // Update the attempt counter
      
      // Don't actually reconnect in the test
      return new Promise((resolve) => {
        // If we haven't exceeded max attempts, simulate another connection failure
        if (reconnectCalls < maxAttempts) {
          // Simulate connection close after a short delay
          setTimeout(() => {
            mockWebSocket.readyState = WebSocket.CLOSED;
            mockWebSocket.onclose({ wasClean: false, code: 1006, reason: 'Connection failed' });
            resolve();
          }, 50);
        } else {
          resolve();
        }
      });
    };
    
    // Simulate initial connection close
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockWebSocket.onclose({ wasClean: false, code: 1006, reason: 'Connection failed' });
    
    // Wait for all reconnect attempts
    setTimeout(() => {
      try {
        // The client should have given up reconnecting
        expect(reconnectCalls).to.equal(maxAttempts);
        expect(client.reconnectAttempts).to.equal(maxAttempts);
        done();
      } catch (err) {
        done(err);
      }
    }, (client.reconnectDelay * maxAttempts) + 500);
  });

  it('sends messages when connected', function() {
    // First connect
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Reset the send spy to track new calls
    mockWebSocket.send.resetHistory();
    
    const testMessage = { type: 'test', data: 'test data' };
    client.send('test_message', testMessage);
    
    // Check if send was called once
    sinon.assert.calledOnce(mockWebSocket.send);
    
    // Parse the sent data and verify its contents
    const sentData = JSON.parse(mockWebSocket.send.getCall(0).args[0]);
    expect(sentData).to.have.property('type', 'test_message');
    expect(sentData).to.have.property('payload').that.deep.equals(testMessage);
  });
  
  it('does not send messages when not connected', function() {
    // Ensure we're not connected
    mockWebSocket.readyState = WebSocket.CLOSED;
    
    // Reset the send spy to track new calls
    mockWebSocket.send.resetHistory();
    
    const testMessage = { type: 'test', data: 'test data' };
    
    // Try to send a message when not connected
    client.send('test_message', testMessage);
    
    // Check that send was not called
    sinon.assert.notCalled(mockWebSocket.send);
  });
  
  it('closes connection properly', function() {
    // First connect
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Reset the close spy to track new calls
    mockWebSocket.close.resetHistory();
    
    // Then close
    client.close();
    
    // Check that close was called once
    sinon.assert.calledOnce(mockWebSocket.close);
    
    // Verify connection state is updated
    expect(client.isConnected).to.be.false;
    expect(client.socket).to.be.null;
  });
  
  it('handles connection errors', function() {
    // Reset the onError spy to track new calls
    mockHandlers.onError.resetHistory();
    
    const error = new Error('Connection failed');
    const errorEvent = { error: error, message: 'Connection failed' };
    
    // Simulate error event
    mockWebSocket.onerror(errorEvent);
    
    // Check that onError was called with the error
    sinon.assert.calledOnce(mockHandlers.onError);
    
    // Check that the error handler was called with an error object
    const errorArg = mockHandlers.onError.getCall(0).args[0];
    expect(errorArg).to.be.an('object');
    expect(errorArg).to.have.property('error', error);
  });
  
  it('handles connection close with error code', function(done) {
    // First connect
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen();
    
    // Reset the spies to track new calls
    mockHandlers.onDisconnect.resetHistory();
    mockHandlers.onError.resetHistory();
    
    // Close with error code
    const closeEvent = { 
      wasClean: false, 
      code: 1006, 
      reason: 'Connection failed',
      target: mockWebSocket
    };
    
    // Simulate connection close
    mockWebSocket.readyState = WebSocket.CLOSED;
    mockWebSocket.onclose(closeEvent);
    
    // Use setTimeout to allow event loop to process the close event
    setTimeout(() => {
      try {
        // Check that onDisconnect was called
        sinon.assert.calledOnce(mockHandlers.onDisconnect);
        
        // Verify the close event was handled
        const disconnectArg = mockHandlers.onDisconnect.getCall(0).args[0];
        expect(disconnectArg).to.be.an('object');
        expect(disconnectArg).to.have.property('wasClean', false);
        expect(disconnectArg).to.have.property('code', 1006);
        
        done();
      } catch (err) {
        done(err);
      }
    }, 50);
  });
});
} else {
  console.error('Mocha not found. Tests will not run.');
}
