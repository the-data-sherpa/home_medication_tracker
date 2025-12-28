/** Medication administration tracking */
import { administrationsAPI, assignmentsAPI } from './api.js';
import { showToast, showModal, closeModal } from './app.js';

let statusTimers = {};

export async function recordAdministration(assignmentId, dose, notes = null, caregiverId = null) {
    try {
        await administrationsAPI.create({
            medication_assignment_id: assignmentId,
            caregiver_id: caregiverId,
            dose_given: dose,
            notes: notes
        });
        showToast('Medication administration recorded', 'success');
        return true;
    } catch (error) {
        const errorMsg = error.message || 'Failed to record administration';
        showToast(errorMsg, 'error');
        console.error(error);
        return false;
    }
}

export async function getAssignmentStatus(assignmentId) {
    try {
        return await assignmentsAPI.getStatus(assignmentId);
    } catch (error) {
        console.error(error);
        return null;
    }
}

export function formatTimeUntilNext(hours) {
    if (hours <= 0) return 'Ready now';
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${Math.round(hours * 10) / 10} hours`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round((hours % 24) * 10) / 10;
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours > 0 ? remainingHours + ' hours' : ''}`;
}

export function startStatusTimer(assignmentId, updateCallback) {
    // Clear existing timer
    if (statusTimers[assignmentId]) {
        clearInterval(statusTimers[assignmentId]);
    }
    
    // Update immediately
    updateCallback();
    
    // Update every minute
    statusTimers[assignmentId] = setInterval(() => {
        updateCallback();
    }, 60000);
}

export function stopStatusTimer(assignmentId) {
    if (statusTimers[assignmentId]) {
        clearInterval(statusTimers[assignmentId]);
        delete statusTimers[assignmentId];
    }
}

export function stopAllTimers() {
    Object.keys(statusTimers).forEach(id => {
        clearInterval(statusTimers[id]);
    });
    statusTimers = {};
}

export async function showGiveMedicationForm(assignment) {
    const status = await getAssignmentStatus(assignment.id);
    const dose = assignment.current_dose || assignment.medication.default_dose;
    
    // Load caregivers for selection
    const { caregiversAPI } = await import('./api.js');
    let caregivers = [];
    try {
        caregivers = await caregiversAPI.getAll();
    } catch (error) {
        console.error('Failed to load caregivers', error);
    }
    
    const content = `
        <h3>Give Medication</h3>
        <div class="medication-info">
            <p><strong>${escapeHtml(assignment.medication.name)}</strong></p>
            <p>For: ${escapeHtml(assignment.family_member.name)}</p>
            <p>Dose: ${escapeHtml(dose)}</p>
        </div>
        <form id="give-medication-form">
            <div class="form-group">
                <label for="admin-caregiver">Given By (optional)</label>
                <select id="admin-caregiver">
                    <option value="">Select caregiver</option>
                    ${caregivers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="admin-dose">Dose Given</label>
                <input type="text" id="admin-dose" value="${escapeHtml(dose)}" required>
            </div>
            <div class="form-group">
                <label for="admin-notes">Notes (optional)</label>
                <textarea id="admin-notes" placeholder="e.g., Child seemed drowsy"></textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-success">Record Administration</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal(content);
    
    document.getElementById('give-medication-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const doseGiven = document.getElementById('admin-dose').value.trim();
        const notes = document.getElementById('admin-notes').value.trim() || null;
        const caregiverId = document.getElementById('admin-caregiver').value ? parseInt(document.getElementById('admin-caregiver').value) : null;
        
        const success = await recordAdministration(assignment.id, doseGiven, notes, caregiverId);
        if (success) {
            closeModal();
            if (window.loadDashboard) {
                await window.loadDashboard();
            }
        }
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

