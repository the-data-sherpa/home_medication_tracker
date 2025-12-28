/** Caregiver management */
import { caregiversAPI } from './api.js';
import { showToast, showModal, closeModal, setButtonLoading } from './app.js';

let caregivers = [];

export async function loadCaregivers() {
    const container = document.getElementById('caregivers-list');
    if (container) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading caregivers...</p></div>';
    }
    
    try {
        caregivers = await caregiversAPI.getAll();
        renderCaregivers();
        return caregivers;
    } catch (error) {
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load caregivers. Please try again.</p></div>';
        }
        showToast('Failed to load caregivers', 'error');
        console.error(error);
        return [];
    }
}

function renderCaregivers() {
    const container = document.getElementById('caregivers-list');
    if (!container) return;

    if (caregivers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No caregivers yet. Add one to get started!</p></div>';
        return;
    }

    container.innerHTML = caregivers.map(caregiver => `
        <div class="card">
            <div class="card-header">
                <div class="card-title">${escapeHtml(caregiver.name)}</div>
            </div>
            <div class="card-footer">
                <button class="btn btn-danger btn-small" onclick="deleteCaregiver(${caregiver.id})">Remove</button>
            </div>
        </div>
    `).join('');
}

export function showAddCaregiverForm() {
    const content = `
        <h3>Add Caregiver</h3>
        <form id="add-caregiver-form">
            <div class="form-group">
                <label for="caregiver-name">Name</label>
                <input type="text" id="caregiver-name" required>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Add</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal(content);
    
    document.getElementById('add-caregiver-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        const name = document.getElementById('caregiver-name').value.trim();
        
        if (!name) {
            showToast('Please enter a name', 'error');
            return;
        }
        
        setButtonLoading(submitButton, true);
        try {
            await caregiversAPI.create({ name });
            showToast('Caregiver added successfully', 'success');
            closeModal();
            await loadCaregivers();
        } catch (error) {
            const errorMsg = error.message || 'Failed to add caregiver';
            showToast(errorMsg, 'error');
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

window.deleteCaregiver = async function(id) {
    if (!confirm('Are you sure you want to remove this caregiver?')) {
        return;
    }
    
    try {
        await caregiversAPI.delete(id);
        showToast('Caregiver removed', 'success');
        await loadCaregivers();
    } catch (error) {
        const errorMsg = error.message || 'Failed to remove caregiver';
        showToast(errorMsg, 'error');
        console.error(error);
    }
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('add-caregiver-btn')?.addEventListener('click', showAddCaregiverForm);
    });
} else {
    document.getElementById('add-caregiver-btn')?.addEventListener('click', showAddCaregiverForm);
}

