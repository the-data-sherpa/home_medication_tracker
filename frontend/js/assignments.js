/** Medication assignment management */
import { assignmentsAPI } from './api.js';
import { medicationsAPI } from './api.js';
import { familyMembersAPI } from './api.js';
import { showToast, showModal, closeModal, setButtonLoading } from './app.js';

export async function showAssignMedicationForm() {
    try {
        const [medications, familyMembers] = await Promise.all([
            medicationsAPI.getAll(),
            familyMembersAPI.getAll()
        ]);

        if (medications.length === 0) {
            showToast('Please add medications first', 'error');
            return;
        }

        if (familyMembers.length === 0) {
            showToast('Please add family members first', 'error');
            return;
        }

        const content = `
            <h3>Assign Medication</h3>
            <form id="assign-medication-form">
                <div class="form-group">
                    <label for="assign-family">Family Member</label>
                    <select id="assign-family" required>
                        <option value="">Select family member</option>
                        ${familyMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="assign-medication">Medication</label>
                    <select id="assign-medication" required>
                        <option value="">Select medication</option>
                        ${medications.map(m => {
                            const freqType = (m.default_frequency_min_hours && m.default_frequency_max_hours) ? 'range' : 'fixed';
                            const freqValue = freqType === 'range' 
                                ? `${m.default_frequency_min_hours}-${m.default_frequency_max_hours}`
                                : m.default_frequency_hours;
                            return `<option value="${m.id}" data-dose="${escapeHtml(m.default_dose)}" data-frequency="${freqValue}" data-frequency-type="${freqType}" data-frequency-min="${m.default_frequency_min_hours || ''}" data-frequency-max="${m.default_frequency_max_hours || ''}">${escapeHtml(m.name)}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="assign-dose">Dose (leave empty to use default)</label>
                    <input type="text" id="assign-dose" placeholder="e.g., 2.5mL">
                </div>
                <div class="form-group">
                    <label for="assign-frequency-type">Frequency Override (leave empty to use default)</label>
                    <select id="assign-frequency-type">
                        <option value="">Use medication default</option>
                        <option value="fixed">Fixed (e.g., every 4 hours)</option>
                        <option value="range">Range (e.g., every 4-6 hours)</option>
                    </select>
                </div>
                <div class="form-group" id="assign-frequency-fixed-group" style="display: none;">
                    <label for="assign-frequency">Frequency in hours</label>
                    <input type="number" id="assign-frequency" step="0.5" min="0.5" placeholder="e.g., 4">
                </div>
                <div class="form-group" id="assign-frequency-range-group" style="display: none;">
                    <label for="assign-frequency-min">Minimum Frequency (hours)</label>
                    <input type="number" id="assign-frequency-min" step="0.5" min="0.5" placeholder="e.g., 4">
                    <label for="assign-frequency-max" style="margin-top: 0.5rem;">Maximum Frequency (hours)</label>
                    <input type="number" id="assign-frequency-max" step="0.5" min="0.5" placeholder="e.g., 6">
                </div>
                <div class="form-group">
                    <label for="assign-schedule-type">Schedule Type</label>
                    <select id="assign-schedule-type">
                        <option value="">None</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
                <div class="form-group" id="schedule-time-group" style="display: none;">
                    <label for="assign-schedule-time">Time</label>
                    <input type="time" id="assign-schedule-time">
                </div>
                <div class="form-group" id="schedule-days-group" style="display: none;">
                    <label>Days of Week</label>
                    <div>
                        ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => `
                            <label style="display: block; margin: 0.25rem 0;">
                                <input type="checkbox" value="${day.toLowerCase()}" class="schedule-day-checkbox">
                                ${day}
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Assign</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `;
        
        showModal(content);
        
        // Auto-fill dose and frequency when medication is selected
        const medSelect = document.getElementById('assign-medication');
        const doseInput = document.getElementById('assign-dose');
        const freqTypeSelect = document.getElementById('assign-frequency-type');
        const fixedGroup = document.getElementById('assign-frequency-fixed-group');
        const rangeGroup = document.getElementById('assign-frequency-range-group');
        const freqInput = document.getElementById('assign-frequency');
        const freqMinInput = document.getElementById('assign-frequency-min');
        const freqMaxInput = document.getElementById('assign-frequency-max');
        
        medSelect.addEventListener('change', (e) => {
            const option = e.target.selectedOptions[0];
            if (option && option.dataset.dose) {
                doseInput.placeholder = `Default: ${option.dataset.dose}`;
                const freqType = option.dataset.frequencyType;
                if (freqType === 'range') {
                    freqTypeSelect.innerHTML = `
                        <option value="">Use medication default (${option.dataset.frequency} hours)</option>
                        <option value="fixed">Fixed (e.g., every 4 hours)</option>
                        <option value="range">Range (e.g., every 4-6 hours)</option>
                    `;
                } else {
                    freqTypeSelect.innerHTML = `
                        <option value="">Use medication default (${option.dataset.frequency} hours)</option>
                        <option value="fixed">Fixed (e.g., every 4 hours)</option>
                        <option value="range">Range (e.g., every 4-6 hours)</option>
                    `;
                }
            }
        });
        
        freqTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'fixed') {
                fixedGroup.style.display = 'block';
                rangeGroup.style.display = 'none';
            } else if (e.target.value === 'range') {
                fixedGroup.style.display = 'none';
                rangeGroup.style.display = 'block';
            } else {
                fixedGroup.style.display = 'none';
                rangeGroup.style.display = 'none';
            }
        });
        
        // Show/hide schedule fields
        const scheduleType = document.getElementById('assign-schedule-type');
        const timeGroup = document.getElementById('schedule-time-group');
        const daysGroup = document.getElementById('schedule-days-group');
        
        scheduleType.addEventListener('change', (e) => {
            if (e.target.value === 'daily') {
                timeGroup.style.display = 'block';
                daysGroup.style.display = 'none';
            } else if (e.target.value === 'weekly') {
                timeGroup.style.display = 'block';
                daysGroup.style.display = 'block';
            } else {
                timeGroup.style.display = 'none';
                daysGroup.style.display = 'none';
            }
        });
        
        document.getElementById('assign-medication-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            setButtonLoading(submitButton, true);
            
            try {
                const familyId = parseInt(document.getElementById('assign-family').value);
                const medicationId = parseInt(document.getElementById('assign-medication').value);
                const dose = document.getElementById('assign-dose').value.trim() || null;
                const freqTypeOverride = document.getElementById('assign-frequency-type').value;
                const scheduleType = document.getElementById('assign-schedule-type').value || null;
                const scheduleTime = document.getElementById('assign-schedule-time').value || null;
                
                let scheduleDays = null;
                if (scheduleType === 'weekly') {
                    const checked = Array.from(document.querySelectorAll('.schedule-day-checkbox:checked')).map(cb => cb.value);
                    scheduleDays = checked.length > 0 ? checked.join(',') : null;
                }
                
                const data = {
                    family_member_id: familyId,
                    medication_id: medicationId,
                    current_dose: dose,
                    schedule_type: scheduleType,
                    schedule_time: scheduleTime,
                    schedule_days: scheduleDays
                };
                
                // Handle frequency override
                if (freqTypeOverride === 'fixed') {
                    const freq = document.getElementById('assign-frequency').value.trim();
                    if (!freq) {
                        showToast('Frequency is required when using fixed frequency type', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    const freqValue = parseFloat(freq);
                    if (isNaN(freqValue) || freqValue <= 0) {
                        showToast('Frequency must be a number greater than 0', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    data.frequency_hours = freqValue;
                    data.frequency_min_hours = null;
                    data.frequency_max_hours = null;
                } else if (freqTypeOverride === 'range') {
                    const minFreq = document.getElementById('assign-frequency-min').value.trim();
                    const maxFreq = document.getElementById('assign-frequency-max').value.trim();
                    if (!minFreq || !maxFreq) {
                        showToast('Both minimum and maximum frequencies are required when using range frequency type', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    const minValue = parseFloat(minFreq);
                    const maxValue = parseFloat(maxFreq);
                    if (isNaN(minValue) || isNaN(maxValue) || minValue <= 0 || maxValue <= 0) {
                        showToast('Frequencies must be numbers greater than 0', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    if (minValue >= maxValue) {
                        showToast('Minimum frequency must be less than maximum', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    data.frequency_min_hours = minValue;
                    data.frequency_max_hours = maxValue;
                    data.frequency_hours = null;
                } else {
                    // Use medication default - don't set frequency fields
                    data.frequency_hours = null;
                    data.frequency_min_hours = null;
                    data.frequency_max_hours = null;
                }
                
                await assignmentsAPI.create(data);
                showToast('Medication assigned successfully', 'success');
                closeModal();
                if (window.loadDashboard) {
                    await window.loadDashboard();
                }
            } catch (error) {
                // Check if this is a duplicate assignment error (409 Conflict)
                if (error.status === 409 && error.detail) {
                    const detail = error.detail;
                    const existingId = detail.existing_assignment_id;
                    const isActive = detail.is_active === true;
                    
                    // Show dialog asking if user wants to reactivate/use existing assignment
                    const confirmed = await showDuplicateAssignmentDialog(
                        detail.family_member_name || 'Unknown',
                        detail.medication_name || 'Unknown',
                        isActive
                    );
                    
                    if (confirmed && existingId) {
                        // Reactivate the existing assignment (if inactive) or just close (if already active)
                        try {
                            if (!isActive) {
                                await assignmentsAPI.update(existingId, { active: true });
                                showToast('Assignment reactivated successfully', 'success');
                            } else {
                                showToast('Using existing assignment', 'success');
                            }
                            closeModal();
                            if (window.loadDashboard) {
                                await window.loadDashboard();
                            }
                        } catch (reactivateError) {
                            const errorMsg = reactivateError.message || 'Failed to reactivate assignment';
                            showToast(errorMsg, 'error');
                            console.error(reactivateError);
                        }
                    }
                } else {
                    const errorMsg = error.message || 'Failed to assign medication';
                    showToast(errorMsg, 'error');
                    console.error(error);
                }
            } finally {
                setButtonLoading(submitButton, false);
            }
        });
    } catch (error) {
        showToast('Failed to load data for assignment', 'error');
        console.error(error);
    }
}

export async function showEditAssignmentForm(assignment) {
    try {
        // Fetch full assignment details and edit history
        const [fullAssignment, editHistory] = await Promise.all([
            assignmentsAPI.get(assignment.id),
            assignmentsAPI.getEditHistory(assignment.id).catch(() => []) // Gracefully handle if endpoint doesn't exist yet
        ]);
        
        // Determine current frequency override state
        const hasRangeOverride = fullAssignment.frequency_min_hours && fullAssignment.frequency_max_hours;
        const hasFixedOverride = fullAssignment.frequency_hours !== null && fullAssignment.frequency_hours !== undefined;
        const freqTypeOverride = hasRangeOverride ? 'range' : (hasFixedOverride ? 'fixed' : '');
        
        // Get medication defaults for display
        const medication = fullAssignment.medication;
        const medFreqType = (medication.default_frequency_min_hours && medication.default_frequency_max_hours) ? 'range' : 'fixed';
        const medFreqValue = medFreqType === 'range' 
            ? `${medication.default_frequency_min_hours}-${medication.default_frequency_max_hours}`
            : medication.default_frequency_hours;
        
        // Pre-fill schedule days if weekly
        let scheduleDaysChecked = [];
        if (fullAssignment.schedule_type === 'weekly' && fullAssignment.schedule_days) {
            scheduleDaysChecked = fullAssignment.schedule_days.split(',');
        }
        
        const content = `
            <h3>Edit Assignment</h3>
            <form id="edit-assignment-form">
                <div class="form-group">
                    <label for="edit-family">Family Member</label>
                    <select id="edit-family" disabled>
                        <option value="${fullAssignment.family_member.id}" selected>${escapeHtml(fullAssignment.family_member.name)}</option>
                    </select>
                    <small style="display: block; margin-top: 0.25rem; color: #666;">Family member cannot be changed</small>
                </div>
                <div class="form-group">
                    <label for="edit-medication">Medication</label>
                    <select id="edit-medication" disabled>
                        <option value="${fullAssignment.medication.id}" selected>${escapeHtml(fullAssignment.medication.name)}</option>
                    </select>
                    <small style="display: block; margin-top: 0.25rem; color: #666;">Medication cannot be changed</small>
                </div>
                <div class="form-group">
                    <label for="edit-dose">Dose (leave empty to use default)</label>
                    <input type="text" id="edit-dose" placeholder="e.g., 2.5mL" value="${(fullAssignment.current_dose || '').replace(/"/g, '&quot;')}">
                </div>
                <div class="form-group">
                    <label for="edit-frequency-type">Frequency Override (leave empty to use default)</label>
                    <select id="edit-frequency-type">
                        <option value="">Use medication default (${medFreqValue} hours)</option>
                        <option value="fixed" ${freqTypeOverride === 'fixed' ? 'selected' : ''}>Fixed (e.g., every 4 hours)</option>
                        <option value="range" ${freqTypeOverride === 'range' ? 'selected' : ''}>Range (e.g., every 4-6 hours)</option>
                    </select>
                </div>
                <div class="form-group" id="edit-frequency-fixed-group" style="display: ${freqTypeOverride === 'fixed' ? 'block' : 'none'};">
                    <label for="edit-frequency">Frequency in hours</label>
                    <input type="number" id="edit-frequency" step="0.5" min="0.5" placeholder="e.g., 4" value="${fullAssignment.frequency_hours ?? ''}">
                </div>
                <div class="form-group" id="edit-frequency-range-group" style="display: ${freqTypeOverride === 'range' ? 'block' : 'none'};">
                    <label for="edit-frequency-min">Minimum Frequency (hours)</label>
                    <input type="number" id="edit-frequency-min" step="0.5" min="0.5" placeholder="e.g., 4" value="${fullAssignment.frequency_min_hours || ''}">
                    <label for="edit-frequency-max" style="margin-top: 0.5rem;">Maximum Frequency (hours)</label>
                    <input type="number" id="edit-frequency-max" step="0.5" min="0.5" placeholder="e.g., 6" value="${fullAssignment.frequency_max_hours || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-schedule-type">Schedule Type</label>
                    <select id="edit-schedule-type">
                        <option value="">None</option>
                        <option value="daily" ${fullAssignment.schedule_type === 'daily' ? 'selected' : ''}>Daily</option>
                        <option value="weekly" ${fullAssignment.schedule_type === 'weekly' ? 'selected' : ''}>Weekly</option>
                    </select>
                </div>
                <div class="form-group" id="edit-schedule-time-group" style="display: ${fullAssignment.schedule_type ? 'block' : 'none'};">
                    <label for="edit-schedule-time">Time</label>
                    <input type="time" id="edit-schedule-time" value="${fullAssignment.schedule_time ?? ''}">
                </div>
                <div class="form-group" id="edit-schedule-days-group" style="display: ${fullAssignment.schedule_type === 'weekly' ? 'block' : 'none'};">
                    <label>Days of Week</label>
                    <div>
                        ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                            const dayLower = day.toLowerCase();
                            const isChecked = scheduleDaysChecked.includes(dayLower);
                            return `
                                <label style="display: block; margin: 0.25rem 0;">
                                    <input type="checkbox" value="${dayLower}" class="edit-schedule-day-checkbox" ${isChecked ? 'checked' : ''}>
                                    ${day}
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Update Assignment</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
            ${editHistory && editHistory.length > 0 ? `
                <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #ddd;">
                    <h4 style="margin-bottom: 1rem; cursor: pointer;" onclick="toggleEditHistory()">
                        Edit History <span id="edit-history-toggle" style="font-size: 0.8em; color: #666;">▼</span>
                    </h4>
                    <div id="edit-history-content" style="display: none;">
                        <div style="max-height: 300px; overflow-y: auto;">
                            ${editHistory.map(log => {
                                const changeDate = new Date(log.changed_at);
                                const fieldDisplayName = formatFieldName(log.field_name);
                                const oldVal = log.old_value || '(empty)';
                                const newVal = log.new_value || '(empty)';
                                return `
                                    <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #007bff;">
                                        <div style="font-weight: bold; margin-bottom: 0.25rem;">${escapeHtml(fieldDisplayName)}</div>
                                        <div style="font-size: 0.9em; color: #666;">
                                            <div><strong>From:</strong> ${escapeHtml(oldVal)}</div>
                                            <div><strong>To:</strong> ${escapeHtml(newVal)}</div>
                                            <div style="margin-top: 0.25rem; font-size: 0.85em; color: #999;">
                                                ${changeDate.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
        
        showModal(content);
        
        // Set up event listeners
        const freqTypeSelect = document.getElementById('edit-frequency-type');
        const fixedGroup = document.getElementById('edit-frequency-fixed-group');
        const rangeGroup = document.getElementById('edit-frequency-range-group');
        
        freqTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'fixed') {
                fixedGroup.style.display = 'block';
                rangeGroup.style.display = 'none';
            } else if (e.target.value === 'range') {
                fixedGroup.style.display = 'none';
                rangeGroup.style.display = 'block';
            } else {
                fixedGroup.style.display = 'none';
                rangeGroup.style.display = 'none';
            }
        });
        
        // Show/hide schedule fields
        const scheduleType = document.getElementById('edit-schedule-type');
        const timeGroup = document.getElementById('edit-schedule-time-group');
        const daysGroup = document.getElementById('edit-schedule-days-group');
        
        scheduleType.addEventListener('change', (e) => {
            if (e.target.value === 'daily') {
                timeGroup.style.display = 'block';
                daysGroup.style.display = 'none';
            } else if (e.target.value === 'weekly') {
                timeGroup.style.display = 'block';
                daysGroup.style.display = 'block';
            } else {
                timeGroup.style.display = 'none';
                daysGroup.style.display = 'none';
            }
        });
        
        document.getElementById('edit-assignment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            setButtonLoading(submitButton, true);
            
            try {
                const dose = document.getElementById('edit-dose').value.trim() || null;
                const freqTypeOverride = document.getElementById('edit-frequency-type').value;
                const scheduleType = document.getElementById('edit-schedule-type').value || null;
                const scheduleTime = document.getElementById('edit-schedule-time').value || null;
                
                let scheduleDays = null;
                if (scheduleType === 'weekly') {
                    const checked = Array.from(document.querySelectorAll('.edit-schedule-day-checkbox:checked')).map(cb => cb.value);
                    scheduleDays = checked.length > 0 ? checked.join(',') : null;
                }
                
                const data = {
                    current_dose: dose,
                    schedule_type: scheduleType,
                    schedule_time: scheduleTime,
                    schedule_days: scheduleDays
                };
                
                // Handle frequency override
                if (freqTypeOverride === 'fixed') {
                    const freq = document.getElementById('edit-frequency').value.trim();
                    if (!freq) {
                        showToast('Frequency is required when using fixed frequency type', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    const freqValue = parseFloat(freq);
                    if (isNaN(freqValue) || freqValue <= 0) {
                        showToast('Frequency must be a number greater than 0', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    data.frequency_hours = freqValue;
                    data.frequency_min_hours = null;
                    data.frequency_max_hours = null;
                } else if (freqTypeOverride === 'range') {
                    const minFreq = document.getElementById('edit-frequency-min').value.trim();
                    const maxFreq = document.getElementById('edit-frequency-max').value.trim();
                    if (!minFreq || !maxFreq) {
                        showToast('Both minimum and maximum frequencies are required when using range frequency type', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    const minValue = parseFloat(minFreq);
                    const maxValue = parseFloat(maxFreq);
                    if (isNaN(minValue) || isNaN(maxValue) || minValue <= 0 || maxValue <= 0) {
                        showToast('Frequencies must be numbers greater than 0', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    if (minValue >= maxValue) {
                        showToast('Minimum frequency must be less than maximum', 'error');
                        setButtonLoading(submitButton, false);
                        return;
                    }
                    data.frequency_min_hours = minValue;
                    data.frequency_max_hours = maxValue;
                    data.frequency_hours = null;
                } else {
                    // Use medication default - clear frequency fields
                    data.frequency_hours = null;
                    data.frequency_min_hours = null;
                    data.frequency_max_hours = null;
                }
                
                await assignmentsAPI.update(fullAssignment.id, data);
                showToast('Assignment updated successfully', 'success');
                closeModal();
                if (window.loadDashboard) {
                    await window.loadDashboard();
                }
            } catch (error) {
                const errorMsg = error.message || 'Failed to update assignment';
                showToast(errorMsg, 'error');
                console.error(error);
            } finally {
                setButtonLoading(submitButton, false);
            }
        });
        
        // Set up edit history toggle
        if (editHistory && editHistory.length > 0) {
            window.toggleEditHistory = function() {
                const content = document.getElementById('edit-history-content');
                const toggle = document.getElementById('edit-history-toggle');
                if (content && toggle) {
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        toggle.textContent = '▲';
                    } else {
                        content.style.display = 'none';
                        toggle.textContent = '▼';
                    }
                }
            };
        }
    } catch (error) {
        showToast('Failed to load assignment details', 'error');
        console.error(error);
    }
}

function formatFieldName(fieldName) {
    const fieldMap = {
        'current_dose': 'Dose',
        'frequency_hours': 'Frequency (Fixed)',
        'frequency_min_hours': 'Frequency Min (Range)',
        'frequency_max_hours': 'Frequency Max (Range)',
        'schedule_type': 'Schedule Type',
        'schedule_time': 'Schedule Time',
        'schedule_days': 'Schedule Days',
        'active': 'Active Status'
    };
    return fieldMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

async function showDuplicateAssignmentDialog(familyMemberName, medicationName, isActive) {
    return new Promise((resolve) => {
        const isCurrentlyActive = isActive === true;
        const title = isCurrentlyActive ? 'Duplicate Assignment' : 'Existing Inactive Assignment';
        const message = isCurrentlyActive 
            ? `An active assignment already exists for <strong>${escapeHtml(medicationName)}</strong> for <strong>${escapeHtml(familyMemberName)}</strong>.`
            : `An inactive (stopped) assignment exists for <strong>${escapeHtml(medicationName)}</strong> for <strong>${escapeHtml(familyMemberName)}</strong>.`;
        const buttonText = isCurrentlyActive ? 'Use Existing Assignment' : 'Reactivate Existing Assignment';
        
        const content = `
            <h3>${title}</h3>
            <p>${message}</p>
            <p>Would you like to ${isCurrentlyActive ? 'use' : 'reactivate'} the existing assignment instead of creating a new one?</p>
            ${isCurrentlyActive ? '<p style="color: #666; font-size: 0.9em;"><em>Note: All administration history will be preserved.</em></p>' : ''}
            <div class="form-actions" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-primary" id="reactivate-btn">${buttonText}</button>
                <button type="button" class="btn btn-secondary" id="cancel-duplicate-btn">Cancel</button>
            </div>
        `;
        
        showModal(content);
        
        // Handle reactivate button
        document.getElementById('reactivate-btn')?.addEventListener('click', () => {
            closeModal();
            resolve(true);
        });
        
        // Handle cancel button
        document.getElementById('cancel-duplicate-btn')?.addEventListener('click', () => {
            closeModal();
            resolve(false);
        });
    });
}

export async function showStopAssignmentDialog(assignment) {
    const content = `
        <h3>Stop Assignment</h3>
        <p>Are you sure you want to stop the assignment for <strong>${escapeHtml(assignment.medication.name)}</strong> 
        for <strong>${escapeHtml(assignment.family_member.name)}</strong>?</p>
        <div style="background: #f5f5f5; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
            <p style="margin: 0.5rem 0;"><strong>What will happen:</strong></p>
            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                <li>The assignment will be removed from the dashboard</li>
                <li>All administration history will be preserved</li>
                <li>You can reactivate this assignment later if needed</li>
            </ul>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-danger" id="confirm-stop-btn">Stop Assignment</button>
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
    `;
    
    showModal(content);
    
    document.getElementById('confirm-stop-btn')?.addEventListener('click', async () => {
        const button = document.getElementById('confirm-stop-btn');
        setButtonLoading(button, true);
        
        try {
            await assignmentsAPI.delete(assignment.id);
            showToast('Assignment stopped successfully', 'success');
            closeModal();
            if (window.loadDashboard) {
                await window.loadDashboard();
            }
        } catch (error) {
            const errorMsg = error.message || 'Failed to stop assignment';
            showToast(errorMsg, 'error');
            console.error(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}

let inactiveAssignments = [];
let inactiveAssignmentsPage = 1;
const INACTIVE_ASSIGNMENTS_PER_PAGE = 5;

export async function loadInactiveAssignments(page = 1) {
    const container = document.getElementById('inactive-assignments-list');
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading inactive assignments...</p></div>';
    
    try {
        inactiveAssignments = await assignmentsAPI.getAll({ active: false });
        inactiveAssignmentsPage = page;
        renderInactiveAssignments(inactiveAssignments, page);
        return inactiveAssignments;
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load inactive assignments. Please try again.</p></div>';
        showToast('Failed to load inactive assignments', 'error');
        console.error(error);
        return [];
    }
}

function renderInactiveAssignments(assignments, page = 1) {
    const container = document.getElementById('inactive-assignments-list');
    if (!container) return;
    
    if (assignments.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No inactive assignments. Stopped assignments will appear here.</p></div>';
        return;
    }
    
    // Sort by updated_at descending (most recently stopped first)
    const sortedAssignments = [...assignments].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at);
        const dateB = new Date(b.updated_at || b.created_at);
        return dateB - dateA;
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(sortedAssignments.length / INACTIVE_ASSIGNMENTS_PER_PAGE);
    const startIdx = (page - 1) * INACTIVE_ASSIGNMENTS_PER_PAGE;
    const endIdx = startIdx + INACTIVE_ASSIGNMENTS_PER_PAGE;
    const pageAssignments = sortedAssignments.slice(startIdx, endIdx);
    
    const assignmentsHtml = pageAssignments.map(assignment => {
        const dose = assignment.current_dose || assignment.medication.default_dose;
        
        // Format stopped date if available
        let stoppedDate = '';
        if (assignment.updated_at && assignment.updated_at !== assignment.created_at) {
            const date = new Date(assignment.updated_at);
            stoppedDate = `<span style="color: #666; font-size: 0.85em;"> • Stopped: ${date.toLocaleDateString()}</span>`;
        }
        
        return `
            <div class="card" style="padding: 0.75rem; margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="flex: 1; min-width: 200px;">
                        <div style="font-weight: 600;">${escapeHtml(assignment.medication.name)}</div>
                        <div style="color: #666; font-size: 0.9em; margin-top: 0.25rem;">
                            ${escapeHtml(assignment.family_member.name)}${stoppedDate}
                        </div>
                        <div style="color: #666; font-size: 0.85em; margin-top: 0.25rem;">
                            ${escapeHtml(dose)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-small" onclick="reactivateAssignment(${assignment.id})" style="white-space: nowrap;">Reactivate</button>
                        <button class="btn btn-secondary btn-small" onclick="viewAssignmentHistory(${assignment.id})" style="white-space: nowrap;">History</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Build pagination controls
    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <div style="color: #666; font-size: 0.9em;">
                    Showing ${startIdx + 1}-${Math.min(endIdx, sortedAssignments.length)} of ${sortedAssignments.length}
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-secondary btn-small" onclick="loadInactiveAssignmentsPage(${page - 1})" ${page === 1 ? 'disabled' : ''} style="min-width: auto; padding: 0.4rem 0.8rem;">
                        Previous
                    </button>
                    <span style="color: #666; font-size: 0.9em; padding: 0 0.5rem;">
                        Page ${page} of ${totalPages}
                    </span>
                    <button class="btn btn-secondary btn-small" onclick="loadInactiveAssignmentsPage(${page + 1})" ${page === totalPages ? 'disabled' : ''} style="min-width: auto; padding: 0.4rem 0.8rem;">
                        Next
                    </button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = assignmentsHtml + paginationHtml;
}

window.loadInactiveAssignmentsPage = async function(page) {
    await loadInactiveAssignments(page);
    // Scroll to top of inactive assignments section
    const container = document.getElementById('inactive-assignments-list');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

window.reactivateAssignment = async function(assignmentId) {
    try {
        await assignmentsAPI.update(assignmentId, { active: true });
        showToast('Assignment reactivated successfully', 'success');
        // Reload inactive assignments list (stay on same page if possible)
        await loadInactiveAssignments(inactiveAssignmentsPage);
        // Reload dashboard if it's currently displayed
        if (window.loadDashboard) {
            await window.loadDashboard();
        }
    } catch (error) {
        const errorMsg = error.message || 'Failed to reactivate assignment';
        showToast(errorMsg, 'error');
        console.error(error);
    }
};

window.viewAssignmentHistory = async function(assignmentId) {
    // Switch to history view and filter by assignment
    const historyView = document.getElementById('history-view');
    const dashboardView = document.getElementById('dashboard-view');
    
    if (historyView && dashboardView) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        historyView.classList.add('active');
        document.querySelector('[data-view="history"]')?.classList.add('active');
        
        // Set filter and load history
        if (window.loadHistory) {
            window.currentHistoryFilter = { assignment_id: assignmentId };
            await window.loadHistory();
        }
    }
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

