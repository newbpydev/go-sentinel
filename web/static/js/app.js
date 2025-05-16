// Main application entry point
document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebSocket client
    const wsClient = new WebSocketClient('ws://' + window.location.host + '/ws', {
        onConnect: () => {
            console.log('WebSocket connected');
            updateConnectionStatus(true);
            showNotification('Connected to server', 'success');
        },
        
        onDisconnect: () => {
            console.log('WebSocket disconnected');
            updateConnectionStatus(false);
            showNotification('Disconnected from server', 'warning');
        },
        
        onTestResults: (results) => {
            console.log('Received test results:', results);
            updateTestResults(results);
            showNotification('Test results updated', 'info');
        },
        
        onMetricsUpdate: (metrics) => {
            console.log('Metrics updated:', metrics);
            updateMetrics(metrics);
        },
        
        onNotification: (notification) => {
            console.log('Notification:', notification);
            showNotification(notification.message, notification.type || 'info');
        },
        
        onError: (error) => {
            console.error('WebSocket error:', error);
            showNotification('Connection error: ' + (error.message || 'Unknown error'), 'error');
        }
    });

    // Expose for debugging
    window.wsClient = wsClient;

    // Set up test buttons
    document.querySelectorAll('[data-test-action]').forEach(button => {
        button.addEventListener('click', (e) => {
            const action = e.target.dataset.testAction;
            handleTestAction(action);
        });
    });

    // Handle test actions
    function handleTestAction(action) {
        switch (action) {
            case 'run-tests':
                wsClient.send('run-tests');
                showNotification('Running tests...', 'info');
                break;
            case 'get-metrics':
                wsClient.send('get-metrics');
                break;
            default:
                console.warn('Unknown test action:', action);
        }
    }

    // Update connection status in the UI
    function updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.className = `status ${connected ? 'connected' : 'disconnected'}`;
        }
    }

    // Update test results in the UI
    function updateTestResults(results) {
        const resultsContainer = document.getElementById('test-results');
        if (!resultsContainer) return;
        
        if (!Array.isArray(results) || results.length === 0) {
            resultsContainer.innerHTML = '<p>No test results available</p>';
            return;
        }
        
        const html = `
            <table class="test-results-table">
                <thead>
                    <tr>
                        <th>Test</th>
                        <th>Status</th>
                        <th>Duration</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(test => `
                        <tr class="test-result ${test.status}">
                            <td>${test.name}</td>
                            <td><span class="status-badge ${test.status}">${test.status}</span></td>
                            <td>${test.duration || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        resultsContainer.innerHTML = html;
    }

    // Update metrics in the UI
    function updateMetrics(metrics) {
        // Update metrics display if it exists
        const metricsContainer = document.getElementById('metrics');
        if (metricsContainer) {
            metricsContainer.textContent = JSON.stringify(metrics, null, 2);
        }
    }

    // Show a notification to the user
    function showNotification(message, type = 'info') {
        // Simple notification system - can be enhanced with a proper UI library
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        const container = document.getElementById('notifications') || document.body;
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
});
