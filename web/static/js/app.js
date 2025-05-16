// Main application entry point
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const connectBtn = document.getElementById('connect-btn');
    const connectionStatus = document.getElementById('connection-status');
    const testResultsContainer = document.getElementById('test-results');
    const sendTestBtn = document.getElementById('send-test-btn');
    const metricsContainer = document.getElementById('metrics-container');
    const notificationContainer = document.getElementById('notification-container');

    // Only initialize WebSocket client if we're on a page that needs it
    if (!connectBtn) return;

    // Initialize WebSocket client
    const wsClient = new WebSocketClient('ws://' + window.location.host + '/ws', {
        onConnect: () => {
            console.log('WebSocket connected');
            updateConnectionStatus('connected');
        },
        onDisconnect: () => {
            console.log('WebSocket disconnected');
            updateConnectionStatus('disconnected');
        },
        onTestResults: (results) => {
            console.log('Test results received:', results);
            updateTestResults(results);
        },
        onMetricsUpdate: (metrics) => {
            console.log('Metrics updated:', metrics);
            updateMetrics(metrics);
        },
        onNotification: (notification) => {
            console.log('Notification received:', notification);
            showNotification(notification);
        },
        onError: (error) => {
            console.error('WebSocket error:', error);
            updateConnectionStatus('error');
        }
    });

    // Event listeners
    connectBtn.addEventListener('click', () => {
        if (wsClient.isConnected) {
            wsClient.close();
        } else {
            updateConnectionStatus('connecting');
            wsClient.connect();
        }
    });

    if (sendTestBtn) {
        sendTestBtn.addEventListener('click', () => {
            if (wsClient.isConnected) {
                wsClient.send('test', { timestamp: new Date().toISOString() });
            } else {
                console.warn('Cannot send test message: WebSocket not connected');
            }
        });
    }

    // Update connection status UI
    function updateConnectionStatus(status) {
        if (!connectionStatus) return;

        // Reset classes
        connectionStatus.className = 'status';

        // Update button text
        if (connectBtn) {
            connectBtn.textContent = wsClient.isConnected ? 'Disconnect' : 'Connect';
        }

        // Update status display
        switch (status) {
            case 'connected':
                connectionStatus.textContent = 'Connected';
                connectionStatus.classList.add('connected');
                break;
            case 'disconnected':
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.classList.add('disconnected');
                break;
            case 'connecting':
                connectionStatus.textContent = 'Connecting...';
                connectionStatus.classList.add('connecting');
                break;
            case 'error':
                connectionStatus.textContent = 'Connection Error';
                connectionStatus.classList.add('error');
                break;
            default:
                connectionStatus.textContent = 'Unknown Status';
        }
    }

    // Update test results UI
    function updateTestResults(results) {
        if (!testResultsContainer || !Array.isArray(results)) return;
        
        testResultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            testResultsContainer.innerHTML = '<p>No test results available</p>';
            return;
        }
        
        const resultsList = document.createElement('div');
        resultsList.className = 'test-results-list';
        
        results.forEach((test, index) => {
            const testElement = document.createElement('div');
            testElement.className = `test-result ${test.status || 'unknown'}`;
            testElement.innerHTML = `
                <span class="test-name">${test.name || `Test ${index + 1}`}</span>
                <span class="test-status">${test.status || 'unknown'}</span>
                ${test.duration ? `<span class="test-duration">${test.duration}</span>` : ''}
            `;
            
            if (test.error) {
                const errorElement = document.createElement('div');
                errorElement.className = 'test-error';
                errorElement.textContent = typeof test.error === 'string' ? test.error : JSON.stringify(test.error);
                testElement.appendChild(errorElement);
            }
            
            resultsList.appendChild(testElement);
        });
        
        testResultsContainer.appendChild(resultsList);
    }

    // Update metrics UI
    function updateMetrics(metrics) {
        if (!metricsContainer) return;
        
        // Simple metrics display - customize based on your needs
        let metricsHtml = '<div class="metrics">';
        for (const [key, value] of Object.entries(metrics || {})) {
            metricsHtml += `<div class="metric"><span class="metric-key">${key}:</span> <span class="metric-value">${value}</span></div>`;
        }
        metricsHtml += '</div>';
        
        metricsContainer.innerHTML = metricsHtml;
    }

    // Show notification
    function showNotification(notification) {
        if (!notificationContainer) return;
        
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification ${notification.type || 'info'}`;
        
        if (notification.title) {
            const titleElement = document.createElement('h4');
            titleElement.textContent = notification.title;
            notificationElement.appendChild(titleElement);
        }
        
        if (notification.message) {
            const messageElement = document.createElement('p');
            messageElement.textContent = notification.message;
            notificationElement.appendChild(messageElement);
        }
        
        // Auto-remove notification after 5 seconds
        notificationContainer.appendChild(notificationElement);
        setTimeout(() => {
            notificationElement.classList.add('fade-out');
            setTimeout(() => notificationElement.remove(), 500);
        }, 5000);
    }

    // Initialize UI
    updateConnectionStatus('disconnected');
    console.log('App initialized');
});
