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
   * @param {number} [reconnectDelay=3000] - Delay between reconnection attempts in ms
   */
  constructor(url, handlers = {}, reconnectDelay = 3000) {
    this.url = url;
    this.handlers = handlers;
    this.reconnectDelay = reconnectDelay;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.socket = null;
    this.isConnected = false;
    this.reconnectTimeout = null;

    this.connect();
  }

  /**
   * Establish WebSocket connection
   */
  connect() {
    if (this.socket) {
      this.socket.close();
    }

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (this.handlers.onConnect) {
          this.handlers.onConnect();
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          if (this.handlers.onError) {
            this.handlers.onError(error);
          }
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        if (this.handlers.onDisconnect) {
          this.handlers.onDisconnect();
        }
        this.scheduleReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.handlers.onError) {
          this.handlers.onError(error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} message - The received message
   */
  handleMessage(message) {
    if (!message || !message.type) {
      console.warn('Received message without type:', message);
      return;
    }

    switch (message.type) {
      case 'test_results':
        if (this.handlers.onTestResults) {
          this.handlers.onTestResults(message.payload);
        }
        break;
      
      case 'metrics-update':
        if (this.handlers.onMetricsUpdate) {
          this.handlers.onMetricsUpdate(message.payload);
        }
        break;
      
      case 'notification':
        if (this.handlers.onNotification) {
          this.handlers.onNotification(message.payload);
        }
        break;
      
      case 'pong':
        // Handle pong response to ping
        break;
      
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send a message to the WebSocket server
   * @param {string} type - Message type
   * @param {*} [payload] - Message payload
   */
  send(type, payload) {
    if (!this.isConnected || !this.socket) {
      console.warn('Cannot send message - WebSocket not connected');
      return false;
    }

    try {
      const message = { type };
      if (payload !== undefined) {
        message.payload = payload;
      }
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      if (this.handlers.onError) {
        this.handlers.onError(error);
      }
      return false;
    }
  }

  /**
   * Close the WebSocket connection
   */
  close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isConnected = false;
  }
}

export { WebSocketClient };
