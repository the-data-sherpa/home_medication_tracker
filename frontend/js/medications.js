/** Medication management */
import { medicationsAPI } from './api.js';
import { showToast, showModal, closeModal, setButtonLoading, showDeleteConfirmation } from './app.js';

let medications = [];

export async function loadMedications() {
    const container = document.getElementById('medications-list');
    if (container) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading medications...</p></div>';
    }
    
    try {
        medications = await medicationsAPI.getAll();
        renderMedications();
        return medications;
    } catch (error) {
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load medications. Please try again.</p></div>';
        }
        showToast('Failed to load medications', 'error');
        console.error(error);
        return [];
    }
}

function renderMedications() {
    const container = document.getElementById('medications-list');
    if (!container) return;

    if (medications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;">💉</div>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-color);">No Medications</h3>
                <p style="color: #666; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
                    Create a medication library with default doses and frequencies. These can be reused when assigning medications to family members.
                </p>
                <button class="btn btn-primary" id="empty-state-add-medication-btn">Add Medication</button>
            </div>
        `;
        // Set up the add button handler
        const addBtn = container.querySelector('#empty-state-add-medication-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => showAddMedicationForm());
        }
        return;
    }

    container.innerHTML = medications.map(med => {
        let freqText = '';
        if (med.default_frequency_min_hours && med.default_frequency_max_hours) {
            freqText = `Every ${med.default_frequency_min_hours}-${med.default_frequency_max_hours} hours`;
        } else if (med.default_frequency_hours) {
            freqText = `Every ${med.default_frequency_hours} hours`;
        } else {
            freqText = 'Frequency not set';
        }
        
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">${escapeHtml(med.name)}</div>
            </div>
            <div class="card-body">
                <p><strong>Default Dose:</strong> ${escapeHtml(med.default_dose)}</p>
                <p><strong>Frequency:</strong> ${freqText}</p>
                ${med.notes ? `<p><strong>Notes:</strong> ${escapeHtml(med.notes)}</p>` : ''}
            </div>
            <div class="card-footer">
                <button class="btn btn-secondary btn-small" onclick="editMedication(${med.id})">Edit</button>
                <button class="btn btn-danger btn-small" onclick="deleteMedication(${med.id})">Delete</button>
            </div>
        </div>
        `;
    }).join('');
}

export function showAddMedicationForm() {
    const content = `
        <h3>Add Medication</h3>
        <form id="add-medication-form">
            <div class="form-group">
                <label for="med-name">Name</label>
                <input type="text" id="med-name" required>
            </div>
            <div class="form-group">
                <label for="med-dose">Default Dose</label>
                <input type="text" id="med-dose" placeholder="e.g., 2.5mL" required>
            </div>
            <div class="form-group">
                <label for="med-frequency-type">Frequency Type</label>
                <select id="med-frequency-type" required>
                    <option value="fixed">Fixed (e.g., every 4 hours)</option>
                    <option value="range">Range (e.g., every 4-6 hours)</option>
                </select>
            </div>
            <div class="form-group" id="med-frequency-fixed-group">
                <label for="med-frequency">Frequency (hours)</label>
                <input type="number" id="med-frequency" step="0.5" min="0.5" placeholder="e.g., 4">
            </div>
            <div class="form-group" id="med-frequency-range-group" style="display: none;">
                <label for="med-frequency-min">Minimum Frequency (hours)</label>
                <input type="number" id="med-frequency-min" step="0.5" min="0.5" placeholder="e.g., 4">
                <label for="med-frequency-max" style="margin-top: 0.5rem;">Maximum Frequency (hours)</label>
                <input type="number" id="med-frequency-max" step="0.5" min="0.5" placeholder="e.g., 6">
            </div>
            <div class="form-group">
                <label for="med-notes">Notes (optional)</label>
                <textarea id="med-notes"></textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Add</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal(content);
    
    // Toggle frequency type fields
    const frequencyType = document.getElementById('med-frequency-type');
    const fixedGroup = document.getElementById('med-frequency-fixed-group');
    const rangeGroup = document.getElementById('med-frequency-range-group');
    
    frequencyType.addEventListener('change', (e) => {
        if (e.target.value === 'fixed') {
            fixedGroup.style.display = 'block';
            rangeGroup.style.display = 'none';
            document.getElementById('med-frequency').required = true;
            document.getElementById('med-frequency-min').required = false;
            document.getElementById('med-frequency-max').required = false;
        } else {
            fixedGroup.style.display = 'none';
            rangeGroup.style.display = 'block';
            document.getElementById('med-frequency').required = false;
            document.getElementById('med-frequency-min').required = true;
            document.getElementById('med-frequency-max').required = true;
        }
    });
    
    document.getElementById('add-medication-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        setButtonLoading(submitButton, true);
        
        try {
            const freqType = document.getElementById('med-frequency-type').value;
            const data = {
                name: document.getElementById('med-name').value.trim(),
                default_dose: document.getElementById('med-dose').value.trim(),
                notes: document.getElementById('med-notes').value.trim() || null
            };
            
            if (freqType === 'fixed') {
                data.default_frequency_hours = parseFloat(document.getElementById('med-frequency').value);
                data.default_frequency_min_hours = null;
                data.default_frequency_max_hours = null;
            } else {
                data.default_frequency_hours = null;
                data.default_frequency_min_hours = parseFloat(document.getElementById('med-frequency-min').value);
                data.default_frequency_max_hours = parseFloat(document.getElementById('med-frequency-max').value);
            }
            
            await medicationsAPI.create(data);
            showToast('Medication added successfully', 'success');
            closeModal();
            await loadMedications();
        } catch (error) {
            showToast('Failed to add medication', 'error');
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

window.editMedication = async function(id) {
    const med = medications.find(m => m.id === id);
    if (!med) return;
    
    const isRange = med.default_frequency_min_hours && med.default_frequency_max_hours;
    const freqType = isRange ? 'range' : 'fixed';
    
    const content = `
        <h3>Edit Medication</h3>
        <form id="edit-medication-form">
            <div class="form-group">
                <label for="edit-med-name">Name</label>
                <input type="text" id="edit-med-name" value="${escapeHtml(med.name)}" required>
            </div>
            <div class="form-group">
                <label for="edit-med-dose">Default Dose</label>
                <input type="text" id="edit-med-dose" value="${escapeHtml(med.default_dose)}" required>
            </div>
            <div class="form-group">
                <label for="edit-med-frequency-type">Frequency Type</label>
                <select id="edit-med-frequency-type" required>
                    <option value="fixed" ${freqType === 'fixed' ? 'selected' : ''}>Fixed (e.g., every 4 hours)</option>
                    <option value="range" ${freqType === 'range' ? 'selected' : ''}>Range (e.g., every 4-6 hours)</option>
                </select>
            </div>
            <div class="form-group" id="edit-med-frequency-fixed-group" style="display: ${freqType === 'fixed' ? 'block' : 'none'};">
                <label for="edit-med-frequency">Frequency (hours)</label>
                <input type="number" id="edit-med-frequency" value="${med.default_frequency_hours || ''}" step="0.5" min="0.5" ${freqType === 'fixed' ? 'required' : ''}>
            </div>
            <div class="form-group" id="edit-med-frequency-range-group" style="display: ${freqType === 'range' ? 'block' : 'none'};">
                <label for="edit-med-frequency-min">Minimum Frequency (hours)</label>
                <input type="number" id="edit-med-frequency-min" value="${med.default_frequency_min_hours || ''}" step="0.5" min="0.5" ${freqType === 'range' ? 'required' : ''}>
                <label for="edit-med-frequency-max" style="margin-top: 0.5rem;">Maximum Frequency (hours)</label>
                <input type="number" id="edit-med-frequency-max" value="${med.default_frequency_max_hours || ''}" step="0.5" min="0.5" ${freqType === 'range' ? 'required' : ''}>
            </div>
            <div class="form-group">
                <label for="edit-med-notes">Notes (optional)</label>
                <textarea id="edit-med-notes">${escapeHtml(med.notes || '')}</textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal(content);
    
    // Toggle frequency type fields
    const frequencyType = document.getElementById('edit-med-frequency-type');
    const fixedGroup = document.getElementById('edit-med-frequency-fixed-group');
    const rangeGroup = document.getElementById('edit-med-frequency-range-group');
    
    frequencyType.addEventListener('change', (e) => {
        if (e.target.value === 'fixed') {
            fixedGroup.style.display = 'block';
            rangeGroup.style.display = 'none';
            document.getElementById('edit-med-frequency').required = true;
            document.getElementById('edit-med-frequency-min').required = false;
            document.getElementById('edit-med-frequency-max').required = false;
        } else {
            fixedGroup.style.display = 'none';
            rangeGroup.style.display = 'block';
            document.getElementById('edit-med-frequency').required = false;
            document.getElementById('edit-med-frequency-min').required = true;
            document.getElementById('edit-med-frequency-max').required = true;
        }
    });
    
    document.getElementById('edit-medication-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        setButtonLoading(submitButton, true);
        
        try {
            const freqType = document.getElementById('edit-med-frequency-type').value;
            const data = {
                name: document.getElementById('edit-med-name').value.trim(),
                default_dose: document.getElementById('edit-med-dose').value.trim(),
                notes: document.getElementById('edit-med-notes').value.trim() || null
            };
            
            if (freqType === 'fixed') {
                const freq = parseFloat(document.getElementById('edit-med-frequency').value);
                if (!freq || freq <= 0) {
                    showToast('Frequency must be greater than 0', 'error');
                    setButtonLoading(submitButton, false);
                    return;
                }
                data.default_frequency_hours = freq;
                data.default_frequency_min_hours = null;
                data.default_frequency_max_hours = null;
            } else {
                const minFreq = parseFloat(document.getElementById('edit-med-frequency-min').value);
                const maxFreq = parseFloat(document.getElementById('edit-med-frequency-max').value);
                if (!minFreq || !maxFreq || minFreq <= 0 || maxFreq <= 0) {
                    showToast('Frequencies must be greater than 0', 'error');
                    setButtonLoading(submitButton, false);
                    return;
                }
                if (minFreq >= maxFreq) {
                    showToast('Minimum frequency must be less than maximum', 'error');
                    setButtonLoading(submitButton, false);
                    return;
                }
                data.default_frequency_hours = null;
                data.default_frequency_min_hours = minFreq;
                data.default_frequency_max_hours = maxFreq;
            }
            
            await medicationsAPI.update(id, data);
            showToast('Medication updated successfully', 'success');
            closeModal();
            await loadMedications();
        } catch (error) {
            const errorMsg = error.message || 'Failed to update medication';
            showToast(errorMsg, 'error');
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
};

window.deleteMedication = async function(id) {
    const med = medications.find(m => m.id === id);
    if (!med) return;
    
    const confirmed = await showDeleteConfirmation(
        'medication',
        med.name,
        () => medicationsAPI.canDelete(id),
        async () => {
            try {
                await medicationsAPI.delete(id);
                showToast('Medication deleted', 'success');
                await loadMedications();
            } catch (error) {
                const errorMsg = error.message || 'Failed to delete medication';
                showToast(errorMsg, 'error');
                console.error(error);
                // Don't re-throw - error is already handled and displayed
            }
        }
    );
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('add-medication-btn')?.addEventListener('click', showAddMedicationForm);
    });
} else {
    document.getElementById('add-medication-btn')?.addEventListener('click', showAddMedicationForm);
}

