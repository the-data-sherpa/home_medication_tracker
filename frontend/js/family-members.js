/** Family member management */
import { familyMembersAPI } from './api.js';
import { showToast, showModal, closeModal, setButtonLoading, showDeleteConfirmation, validateField, showValidationMessage } from './app.js';

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
        const errorMsg = error.actionableMessage || error.message || 'Failed to load family members';
        const actionStep = error.actionableStep || 'Please try again.';
        showToast(errorMsg, 'error', actionStep);
        console.error(error);
        return [];
    }
}

function renderFamilyMembers() {
    const container = document.getElementById('family-list');
    if (!container) return;

    if (familyMembers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;">👨‍👩‍👧‍👦</div>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-color);">No Family Members</h3>
                <p style="color: #666; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
                    Add family members who need medications. You'll need at least one family member before you can assign medications.
                </p>
                <button class="btn btn-primary" id="empty-state-add-family-btn">Add Family Member</button>
            </div>
        `;
        // Set up the add button handler
        const addBtn = container.querySelector('#empty-state-add-family-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => showAddFamilyMemberForm());
        }
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
    
    // Add validation
    const nameInput = document.getElementById('family-name');
    if (nameInput) {
        nameInput.addEventListener('blur', () => validateField(nameInput));
        nameInput.addEventListener('input', () => {
            if (nameInput.validity.valid) {
                showValidationMessage(nameInput, '', true);
            }
        });
    }
    
    document.getElementById('add-family-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        const name = document.getElementById('family-name').value.trim();
        
        // Validate before submitting
        if (!validateField(nameInput)) {
            nameInput.focus();
            return;
        }
        
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
            const errorMsg = error.actionableMessage || error.message || 'Failed to add family member';
            const actionStep = error.actionableStep || 'Please try again.';
            showToast(errorMsg, 'error', actionStep);
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

window.deleteFamilyMember = async function(id) {
    const member = familyMembers.find(m => m.id === id);
    if (!member) return;
    
    const confirmed = await showDeleteConfirmation(
        'family member',
        member.name,
        () => familyMembersAPI.canDelete(id),
        async () => {
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
                // Don't re-throw - error is already handled and displayed
            }
        }
    );
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

