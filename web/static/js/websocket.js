// Ensure WebSocket constants exist
if (typeof WebSocket !== 'undefined') {
  if (!('CONNECTING' in WebSocket)) {
    WebSocket.CONNECTING = 0;
    WebSocket.OPEN = 1;
    WebSocket.CLOSING = 2;
    WebSocket.CLOSED = 3;
  }
} else {
  // Create a mock WebSocket implementation if not available
  window.WebSocket = class MockWebSocket {
    constructor() {
      this.readyState = WebSocket.CONNECTING;
      this.bufferedAmount = 0;
      this.extensions = '';
      this.protocol = '';
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
    }
    
    send() {}
    close() {}
  };
  
  // Add WebSocket constants
  WebSocket.CONNECTING = 0;
  WebSocket.OPEN = 1;
  WebSocket.CLOSING = 2;
  WebSocket.CLOSED = 3;
}

/**
 * WebSocket client for real-time updates
 */
class WebSocketClient {
  /**
   * Create a new WebSocket client
   * @param {string} url - WebSocket server URL
   * @param {Object} handlers - Event handlers
   * @param {Function} [handlers.onConnect] - Called when connection is established
   * @param {Function} [handlers.onDisconnect] - Called when connection is closed
   * @param {Function} [handlers.onTestResults] - Called when test results are received
   * @param {Function} [handlers.onMetricsUpdate] - Called when metrics are updated
   * @param {Function} [handlers.onNotification] - Called when a notification is received
   * @param {Function} [handlers.onError] - Called when an error occurs
   */
  constructor(url, handlers = {}) {
    this.url = url;
    this.handlers = {
      onConnect: () => {},
      onDisconnect: () => {},
      onTestResults: () => {},
      onMetricsUpdate: () => {},
      onNotification: () => {},
      onError: () => {},
      ...handlers
    };
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3 seconds
    this.reconnectTimeout = null;

    this.connect();
  }

  /**
   * Establish WebSocket connection
   */
  connect() {
    // Clear any existing connection
    if (this.socket) {
      this.socket.close();
      clearTimeout(this.reconnectTimeout);
    }

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.handlers.onConnect();
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!message || !message.type) return;

          switch (message.type) {
            case 'test_results':
              this.handlers.onTestResults(message.payload || []);
              break;
            case 'metrics-update':
              this.handlers.onMetricsUpdate(message.payload || {});
              break;
            case 'notification':
              this.handlers.onNotification(message.payload || {});
              break;
            default:
              console.warn(`Unknown message type: ${message.type}`);
          }
        } catch (error) {
          console.error('Error processing message:', error);
          this.handlers.onError(error);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.handlers.onDisconnect();
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handlers.onError(error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server
   * @returns {Promise<void>} Resolves when reconnection is attempted
   */
  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached');
      return Promise.resolve();
    }
    
    this.reconnectAttempts++;
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    return new Promise(resolve => {
      this.reconnectTimeout = setTimeout(() => {
        try {
          this.connect();
        } catch (error) {
          console.error('Error during reconnection:', error);
          this.handlers.onError(error);
        } finally {
          resolve();
        }
      }, delay);
    });
  }

  /**
   * Send a message through the WebSocket
   * @param {string} type - The message type
   * @param {*} payload - The message payload
   * @returns {boolean} True if the message was sent successfully
   */
  send(type, payload) {
    if (!this.isConnected || !this.socket) {
      console.warn('Cannot send message: WebSocket is not connected');
      return false;
    }

    try {
      const message = JSON.stringify({ type, payload });
      this.socket.send(message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.handlers.onError(error);
      return false;
    }
  }

  /**
   * Close the WebSocket connection
   * @param {number} [code=1000] - Close code (1000 = normal closure)
   * @param {string} [reason] - Close reason
   * @returns {Promise<void>} Resolves when the connection is closed
   */
  close(code = 1000, reason) {
    return new Promise((resolve) => {
      // Clear any pending reconnection attempts first
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      if (!this.socket) {
        this.isConnected = false;
        return resolve();
      }
      
      // If already closed, just resolve
      if (this.socket.readyState === WebSocket.CLOSED) {
        this.isConnected = false;
        return resolve();
      }
      
      // Set up a one-time close handler
      const onClose = () => {
        if (this.socket) {
          this.socket.removeEventListener('close', onClose);
        }
        this.isConnected = false;
        resolve();
      };
      
      this.socket.addEventListener('close', onClose);
      
      // Close the socket
      try {
        this.socket.close(code, reason);
        
        // Add a timeout to ensure we always resolve
        setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
            console.warn('WebSocket close timed out, forcing cleanup');
            onClose();
          }
        }, 5000);
      } catch (err) {
        console.error('Error closing WebSocket:', err);
        // If close throws, we still want to resolve
        if (this.socket) {
          this.socket.removeEventListener('close', onClose);
        }
        this.isConnected = false;
        resolve();
      }
    });
  }
}

// Export for ES modules
export { WebSocketClient };

// Also make available globally for tests
if (typeof window !== 'undefined') {
  window.WebSocketClient = WebSocketClient;
}
