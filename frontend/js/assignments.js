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
                    const freq = document.getElementById('assign-frequency').value;
                    if (freq) {
                        const freqValue = parseFloat(freq);
                        if (freqValue <= 0) {
                            showToast('Frequency must be greater than 0', 'error');
                            setButtonLoading(submitButton, false);
                            return;
                        }
                        data.frequency_hours = freqValue;
                    }
                    data.frequency_min_hours = null;
                    data.frequency_max_hours = null;
                } else if (freqTypeOverride === 'range') {
                    const minFreq = document.getElementById('assign-frequency-min').value;
                    const maxFreq = document.getElementById('assign-frequency-max').value;
                    if (minFreq && maxFreq) {
                        const minValue = parseFloat(minFreq);
                        const maxValue = parseFloat(maxFreq);
                        if (minValue <= 0 || maxValue <= 0) {
                            showToast('Frequencies must be greater than 0', 'error');
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
                    }
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
                const errorMsg = error.message || 'Failed to assign medication';
                showToast(errorMsg, 'error');
                console.error(error);
            } finally {
                setButtonLoading(submitButton, false);
            }
        });
    } catch (error) {
        showToast('Failed to load data for assignment', 'error');
        console.error(error);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

