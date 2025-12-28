/** Family member management */
import { familyMembersAPI } from './api.js';
import { showToast, showModal, closeModal, setButtonLoading } from './app.js';

let familyMembers = [];

export async function loadFamilyMembers() {
    const container = document.getElementById('family-list');
    if (container) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading family members...</p></div>';
    }
    
    try {
        familyMembers = await familyMembersAPI.getAll();
        renderFamilyMembers();
        return familyMembers;
    } catch (error) {
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load family members. Please try again.</p></div>';
        }
        showToast('Failed to load family members', 'error');
        console.error(error);
        return [];
    }
}

function renderFamilyMembers() {
    const container = document.getElementById('family-list');
    if (!container) return;

    if (familyMembers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No family members yet. Add one to get started!</p></div>';
        return;
    }

    container.innerHTML = familyMembers.map(member => `
        <div class="card">
            <div class="card-header">
                <div class="card-title">${escapeHtml(member.name)}</div>
            </div>
            <div class="card-footer">
                <button class="btn btn-danger btn-small" onclick="deleteFamilyMember(${member.id})">Remove</button>
            </div>
        </div>
    `).join('');
}

export function showAddFamilyMemberForm() {
    const content = `
        <h3>Add Family Member</h3>
        <form id="add-family-form">
            <div class="form-group">
                <label for="family-name">Name</label>
                <input type="text" id="family-name" required>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Add</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal(content);
    
    document.getElementById('add-family-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        const name = document.getElementById('family-name').value.trim();
        
        if (!name) {
            showToast('Please enter a name', 'error');
            return;
        }
        
        setButtonLoading(submitButton, true);
        try {
            await familyMembersAPI.create({ name });
            showToast('Family member added successfully', 'success');
            closeModal();
            await loadFamilyMembers();
            // Reload dashboard to show new member
            if (window.loadDashboard) {
                await window.loadDashboard();
            }
        } catch (error) {
            const errorMsg = error.message || 'Failed to add family member';
            showToast(errorMsg, 'error');
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

window.deleteFamilyMember = async function(id) {
    if (!confirm('Are you sure you want to remove this family member?')) {
        return;
    }
    
    try {
        await familyMembersAPI.delete(id);
        showToast('Family member removed', 'success');
        await loadFamilyMembers();
        if (window.loadDashboard) {
            await window.loadDashboard();
        }
    } catch (error) {
        const errorMsg = error.message || 'Failed to remove family member';
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
        document.getElementById('add-family-btn')?.addEventListener('click', showAddFamilyMemberForm);
    });
} else {
    document.getElementById('add-family-btn')?.addEventListener('click', showAddFamilyMemberForm);
}

