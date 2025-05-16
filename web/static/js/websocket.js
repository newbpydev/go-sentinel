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
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
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
   */
  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    clearTimeout(this.reconnectTimeout);
  }
}

export { WebSocketClient };
