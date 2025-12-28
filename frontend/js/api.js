/** API client functions */
const API_BASE = '/api';

// Network status tracking
let isOnline = navigator.onLine;
let networkStatusListeners = [];

// Network status management
export function getNetworkStatus() {
    return isOnline;
}

export function onNetworkStatusChange(callback) {
    networkStatusListeners.push(callback);
    return () => {
        networkStatusListeners = networkStatusListeners.filter(cb => cb !== callback);
    };
}

function updateNetworkStatus(online) {
    if (isOnline !== online) {
        isOnline = online;
        networkStatusListeners.forEach(cb => cb(online));
    }
}

// Listen to browser online/offline events
window.addEventListener('online', () => updateNetworkStatus(true));
window.addEventListener('offline', () => updateNetworkStatus(false));

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, Too Many Requests, Server Errors
    retryableErrors: ['NetworkError', 'Failed to fetch', 'TypeError'] // Network-related errors
};

// Exponential backoff delay calculation
function getRetryDelay(attempt) {
    const delay = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
}

// Check if error is retryable
function isRetryableError(error, status) {
    // Network errors are always retryable
    if (error && (
        error.message === 'Failed to fetch' ||
        error.name === 'NetworkError' ||
        error.name === 'TypeError'
    )) {
        return true;
    }
    
    // Check if status code is retryable
    if (status && RETRY_CONFIG.retryableStatuses.includes(status)) {
        return true;
    }
    
    return false;
}

// Enhanced error message with actionable steps
function getActionableErrorMessage(error, status) {
    if (!isOnline) {
        return {
            message: 'You are currently offline. Please check your internet connection.',
            action: 'Check your network connection and try again when online.'
        };
    }
    
    if (error && (error.message === 'Failed to fetch' || error.name === 'NetworkError')) {
        return {
            message: 'Unable to connect to the server.',
            action: 'Please check your internet connection and try again.'
        };
    }
    
    if (status === 408 || status === 504) {
        return {
            message: 'Request timed out.',
            action: 'The server took too long to respond. Please try again in a moment.'
        };
    }
    
    if (status === 429) {
        return {
            message: 'Too many requests.',
            action: 'Please wait a moment before trying again.'
        };
    }
    
    if (status >= 500 && status < 600) {
        return {
            message: 'Server error occurred.',
            action: 'The server encountered an error. Please try again in a moment.'
        };
    }
    
    if (status === 401) {
        return {
            message: 'Authentication required.',
            action: 'Please refresh the page and log in again.'
        };
    }
    
    if (status === 403) {
        return {
            message: 'Access denied.',
            action: 'You do not have permission to perform this action.'
        };
    }
    
    if (status === 404) {
        return {
            message: 'Resource not found.',
            action: 'The requested item may have been deleted or does not exist.'
        };
    }
    
    // Default error message
    const errorMsg = error?.message || `HTTP error! status: ${status || 'unknown'}`;
    return {
        message: errorMsg,
        action: 'Please try again. If the problem persists, refresh the page.'
    };
}

// Retry wrapper for API requests
async function apiRequestWithRetry(endpoint, options = {}, retryCount = 0) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        
        if (response.status === 204) {
            return null;
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            // If response is not JSON, create error from status
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        if (!response.ok) {
            // Handle structured error responses
            let errorMsg = data.detail || data.message || `HTTP error! status: ${response.status}`;
            // If detail is an object, try to extract message or stringify it
            if (typeof errorMsg === 'object') {
                errorMsg = errorMsg.message || JSON.stringify(errorMsg);
            }
            const error = new Error(errorMsg);
            error.status = response.status;  // Attach status code for error handling
            // Attach the full data for structured error handling
            if (typeof data.detail === 'object') {
                error.detail = data.detail;
            }
            
            // Check if we should retry
            if (retryCount < RETRY_CONFIG.maxRetries && isRetryableError(error, response.status)) {
                const delay = getRetryDelay(retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return apiRequestWithRetry(endpoint, options, retryCount + 1);
            }
            
            // Enhance error with actionable message
            const actionableError = getActionableErrorMessage(error, response.status);
            error.actionableMessage = actionableError.message;
            error.actionableStep = actionableError.action;
            
            throw error;
        }
        
        return data;
    } catch (error) {
        // Handle network errors
        if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
            // Check if we should retry
            if (retryCount < RETRY_CONFIG.maxRetries && isRetryableError(error, null)) {
                const delay = getRetryDelay(retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return apiRequestWithRetry(endpoint, options, retryCount + 1);
            }
            
            // Enhance error with actionable message
            const actionableError = getActionableErrorMessage(error, null);
            error.actionableMessage = actionableError.message;
            error.actionableStep = actionableError.action;
        }
        
        console.error('API request failed:', error);
        throw error;
    }
}

// Main API request function (now uses retry)
async function apiRequest(endpoint, options = {}) {
    // Check if offline
    if (!isOnline) {
        const error = new Error('You are currently offline. Please check your internet connection.');
        error.actionableMessage = 'You are currently offline.';
        error.actionableStep = 'Please check your internet connection and try again when online.';
        error.isOffline = true;
        throw error;
    }
    
    return apiRequestWithRetry(endpoint, options);
}

// Family Members API
export const familyMembersAPI = {
    getAll: () => apiRequest('/family-members'),
    create: (data) => apiRequest('/family-members', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/family-members/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/family-members/${id}`, { method: 'DELETE' }),
    canDelete: (id) => apiRequest(`/family-members/${id}/can-delete`)
};

// Caregivers API
export const caregiversAPI = {
    getAll: () => apiRequest('/caregivers'),
    create: (data) => apiRequest('/caregivers', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/caregivers/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/caregivers/${id}`, { method: 'DELETE' }),
    canDelete: (id) => apiRequest(`/caregivers/${id}/can-delete`)
};

// Medications API
export const medicationsAPI = {
    getAll: () => apiRequest('/medications'),
    get: (id) => apiRequest(`/medications/${id}`),
    create: (data) => apiRequest('/medications', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/medications/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/medications/${id}`, { method: 'DELETE' }),
    canDelete: (id) => apiRequest(`/medications/${id}/can-delete`)
};

// Assignments API
export const assignmentsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/assignments${query ? '?' + query : ''}`);
    },
    get: (id) => apiRequest(`/assignments/${id}`),
    create: (data) => apiRequest('/assignments', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/assignments/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/assignments/${id}`, { method: 'DELETE' }),
    getEditHistory: (id) => apiRequest(`/assignments/${id}/edit-history`),
    getStatus: (id) => apiRequest(`/assignments/${id}/status`),
    getScheduled: () => apiRequest('/assignments/scheduled/list')
};

// Administrations API
export const administrationsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/administrations${query ? '?' + query : ''}`);
    },
    get: (id) => apiRequest(`/administrations/${id}`),
    create: (data) => apiRequest('/administrations', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/administrations/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/administrations/${id}`, { method: 'DELETE' })
};

// Inventory API
export const inventoryAPI = {
    getAll: () => apiRequest('/inventory'),
    getLowStock: () => apiRequest('/inventory/low-stock'),
    get: (id) => apiRequest(`/inventory/${id}`),
    create: (data) => apiRequest('/inventory', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/inventory/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/inventory/${id}`, { method: 'DELETE' })
};

// Export API
export const exportAPI = {
    exportJSON: async () => {
        const response = await fetch(`${API_BASE}/export/json`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `medication_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },
    exportCSV: async () => {
        const response = await fetch(`${API_BASE}/export/csv`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `medication_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },
    importJSON: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_BASE}/export/import/json`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Import failed');
        }
        return await response.json();
    }
};

