/** API client functions */
const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
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
            const errorMsg = data.detail || data.message || `HTTP error! status: ${response.status}`;
            throw new Error(errorMsg);
        }
        
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Family Members API
export const familyMembersAPI = {
    getAll: () => apiRequest('/family-members'),
    create: (data) => apiRequest('/family-members', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/family-members/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/family-members/${id}`, { method: 'DELETE' })
};

// Caregivers API
export const caregiversAPI = {
    getAll: () => apiRequest('/caregivers'),
    create: (data) => apiRequest('/caregivers', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/caregivers/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/caregivers/${id}`, { method: 'DELETE' })
};

// Medications API
export const medicationsAPI = {
    getAll: () => apiRequest('/medications'),
    get: (id) => apiRequest(`/medications/${id}`),
    create: (data) => apiRequest('/medications', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/medications/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/medications/${id}`, { method: 'DELETE' })
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

