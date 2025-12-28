/** Medication administration tracking */
import { administrationsAPI, assignmentsAPI } from './api.js';
import { showToast, showModal, closeModal, setButtonLoading, validateField, showValidationMessage } from './app.js';

let statusTimers = {};

export async function recordAdministration(assignmentId, dose, notes = null, caregiverId = null, administeredAt = null) {
    try {
        const data = {
            medication_assignment_id: assignmentId,
            caregiver_id: caregiverId,
            dose_given: dose,
            notes: notes
        };
        
        // Add custom time if provided
        if (administeredAt) {
            data.administered_at = administeredAt;
        }
        
        await administrationsAPI.create(data);
        showToast('Medication administration recorded', 'success');
        return true;
    } catch (error) {
        const errorMsg = error.message || 'Failed to record administration';
        showToast(errorMsg, 'error');
        console.error(error);
        return false;
    }
}

/**
 * Quick give medication - records administration with default dose, current time, and last used caregiver
 */
export async function quickGiveMedication(assignment) {
    try {
        // Get the default dose
        const dose = assignment.current_dose || assignment.medication.default_dose;
        
        // Get last used caregiver for this assignment
        let lastCaregiverId = null;
        try {
            const recentAdmins = await administrationsAPI.getAll({ 
                assignment_id: assignment.id,
                limit: 1 
            });
            if (recentAdmins && recentAdmins.length > 0 && recentAdmins[0].caregiver_id) {
                lastCaregiverId = recentAdmins[0].caregiver_id;
            }
        } catch (error) {
            console.warn('Could not fetch last caregiver, continuing without it', error);
        }
        
        // Record with current time (no custom time = uses current time)
        const success = await recordAdministration(
            assignment.id,
            dose,
            null, // No notes for quick give
            lastCaregiverId,
            null  // null = current time
        );
        
        return success;
    } catch (error) {
        const errorMsg = error.message || 'Failed to quick give medication';
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
    
    // Set default time to now (for datetime-local input format: YYYY-MM-DDTHH:mm)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const defaultDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    const content = `
        <h3>Give Medication</h3>
        <div class="medication-info">
            <p><strong>${escapeHtml(assignment.medication.name)}</strong></p>
            <p>For: ${escapeHtml(assignment.family_member.name)}</p>
            <p>Dose: ${escapeHtml(dose)}</p>
        </div>
        <form id="give-medication-form">
            <div class="form-group">
                <label for="admin-time">Administration Time</label>
                <input type="datetime-local" id="admin-time" value="${defaultDateTime}" required>
                <small style="display: block; margin-top: 0.25rem; color: #666;">
                    You can backdate up to 24 hours if you forgot to log earlier
                </small>
                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary btn-small" onclick="setAdminTime(-5)">5 min ago</button>
                    <button type="button" class="btn btn-secondary btn-small" onclick="setAdminTime(-10)">10 min ago</button>
                    <button type="button" class="btn btn-secondary btn-small" onclick="setAdminTime(-15)">15 min ago</button>
                    <button type="button" class="btn btn-secondary btn-small" onclick="setAdminTime(0)">Now</button>
                </div>
            </div>
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
    
    // Set up quick time buttons
    window.setAdminTime = function(minutesOffset) {
        const timeInput = document.getElementById('admin-time');
        if (!timeInput) return;
        
        const now = new Date();
        const targetTime = new Date(now.getTime() + minutesOffset * 60000);
        
        const year = targetTime.getFullYear();
        const month = String(targetTime.getMonth() + 1).padStart(2, '0');
        const day = String(targetTime.getDate()).padStart(2, '0');
        const hours = String(targetTime.getHours()).padStart(2, '0');
        const minutes = String(targetTime.getMinutes()).padStart(2, '0');
        const dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        timeInput.value = dateTimeValue;
    };
    
    document.getElementById('give-medication-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        setButtonLoading(submitButton, true);
        
        try {
            const dateTimeInput = document.getElementById('admin-time').value;
            const doseGiven = document.getElementById('admin-dose').value.trim();
            const notes = document.getElementById('admin-notes').value.trim() || null;
            const caregiverId = document.getElementById('admin-caregiver').value ? parseInt(document.getElementById('admin-caregiver').value) : null;
            
            // Convert datetime-local (which is in local time) to UTC ISO string
            const localDate = new Date(dateTimeInput);
            
            // Validate the date was parsed correctly
            if (isNaN(localDate.getTime())) {
                showToast('Invalid date/time format', 'error');
                setButtonLoading(submitButton, false);
                return;
            }
            
            // Validate not in future
            if (localDate > new Date()) {
                showToast('Administration time cannot be in the future', 'error');
                setButtonLoading(submitButton, false);
                return;
            }
            
            // Validate not more than 24 hours in the past
            const now = new Date();
            const maxBackdate = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            if (localDate < (now - maxBackdate)) {
                showToast('Administration time cannot be more than 24 hours in the past', 'error');
                setButtonLoading(submitButton, false);
                return;
            }
            
            // Convert to UTC ISO string - toISOString() automatically converts to UTC
            const isoDateTime = localDate.toISOString();
            
            const success = await recordAdministration(assignment.id, doseGiven, notes, caregiverId, isoDateTime);
            if (success) {
                closeModal();
                if (window.loadDashboard) {
                    await window.loadDashboard();
                }
            }
        } catch (error) {
            const errorMsg = error.message || 'Failed to record administration';
            showToast(errorMsg, 'error');
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

