/** Dashboard view with medication assignments and status */
import { assignmentsAPI } from './api.js';
import { getAssignmentStatus, formatTimeUntilNext, startStatusTimer, stopStatusTimer, showGiveMedicationForm, quickGiveMedication } from './administrations.js';
import { showToast } from './app.js';
import { showEditAssignmentForm, showStopAssignmentDialog, showAssignMedicationForm } from './assignments.js';

let assignments = [];
let quickGiveMode = {}; // Track quick give mode per assignment (defaults to true)

export async function loadDashboard() {
    const container = document.getElementById('assignments-list');
    if (container) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading dashboard...</p></div>';
    }
    
    try {
        assignments = await assignmentsAPI.getAll({ active: true });
        renderDashboard();
        return assignments;
    } catch (error) {
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load dashboard. Please try again.</p></div>';
        }
        showToast('Failed to load dashboard', 'error');
        console.error(error);
        return [];
    }
}

async function renderDashboard() {
    const container = document.getElementById('assignments-list');
    if (!container) return;

    if (assignments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;">💊</div>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-color);">No Active Medication Assignments</h3>
                <p style="color: #666; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
                    Get started by assigning medications to family members. Once assigned, you'll see medication status, timing information, and be able to record administrations here.
                </p>
                <button class="btn btn-primary" id="empty-state-assign-btn">Assign Medication</button>
            </div>
        `;
        // Set up the assign button handler
        const assignBtn = container.querySelector('#empty-state-assign-btn');
        if (assignBtn) {
            assignBtn.addEventListener('click', () => showAssignMedicationForm());
        }
        return;
    }

    // Stop all existing timers
    Object.keys(assignments).forEach(id => stopStatusTimer(id));

    // Load status for each assignment
    const statusPromises = assignments.map(async (assignment) => {
        const status = await getAssignmentStatus(assignment.id);
        return { assignment, status };
    });

    const assignmentsWithStatus = await Promise.all(statusPromises);

    // Sort by status priority (overdue > soon > ready)
    assignmentsWithStatus.sort((a, b) => {
        const priority = { 'overdue': 0, 'soon': 1, 'ready': 2 };
        return (priority[a.status?.status] ?? 3) - (priority[b.status?.status] ?? 3);
    });

    container.innerHTML = assignmentsWithStatus.map(({ assignment, status }) => {
        const dose = assignment.current_dose || assignment.medication.default_dose;
        
        // Determine frequency display
        let freqText = '';
        const hasRangeOverride = assignment.frequency_min_hours && assignment.frequency_max_hours;
        const medHasRange = assignment.medication.default_frequency_min_hours && assignment.medication.default_frequency_max_hours;
        
        if (hasRangeOverride || (!assignment.frequency_hours && medHasRange)) {
            const min = assignment.frequency_min_hours || assignment.medication.default_frequency_min_hours;
            const max = assignment.frequency_max_hours || assignment.medication.default_frequency_max_hours;
            freqText = `Every ${min}-${max} hours`;
        } else {
            const freq = assignment.frequency_hours || assignment.medication.default_frequency_hours;
            freqText = `Every ${freq} hours`;
        }
        
        const statusClass = status?.status || 'ready';
        const canGive = status?.can_administer ?? true;
        
        let statusText = '';
        let timerText = '';
        
        if (status) {
            if (status.can_administer) {
                if (status.status === 'overdue') {
                    statusText = 'Overdue - Give now';
                } else {
                    statusText = 'Ready to give';
                }
            } else if (status.time_until_next) {
                statusText = `Available in ${formatTimeUntilNext(status.time_until_next)}`;
                timerText = `<div class="timer">Next dose: ${formatTimeUntilNext(status.time_until_next)}</div>`;
                if (status.frequency_type === 'range' && status.time_until_max) {
                    timerText += `<div class="timer">Max time: ${formatTimeUntilNext(status.time_until_max)}</div>`;
                }
            }
            
            if (status.last_administration) {
                const lastTime = new Date(status.last_administration);
                timerText += `<div class="timer">Last given: ${lastTime.toLocaleString()}</div>`;
            }
        }

        return `
            <div class="card assignment-card status-${statusClass}" id="assignment-${assignment.id}">
                <div class="card-header">
                    <div>
                        <div class="medication-name">${escapeHtml(assignment.medication.name)}</div>
                        <div class="family-member-name">For: ${escapeHtml(assignment.family_member.name)}</div>
                    </div>
                    <span class="status-badge status-${statusClass}">${statusText || 'Ready'}</span>
                </div>
                <div class="card-body">
                    <div class="dose-info">
                        <p><strong>Dose:</strong> ${escapeHtml(dose)}</p>
                        <p><strong>Frequency:</strong> ${freqText}</p>
                        ${assignment.schedule_type ? `<p><strong>Schedule:</strong> ${formatSchedule(assignment)}</p>` : ''}
                    </div>
                    ${timerText}
                </div>
                <div class="card-footer">
                    <div class="give-medication-control" style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                        <label class="quick-give-toggle" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none;">
                            <input type="checkbox" id="quick-give-toggle-${assignment.id}" ${quickGiveMode[assignment.id] !== false ? 'checked' : ''} onchange="toggleQuickGiveMode(${assignment.id})" aria-label="Toggle quick give mode">
                            <span class="toggle-slider-small"></span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">Quick</span>
                        </label>
                        <button class="btn btn-success btn-small" onclick="giveMedicationWithMode(${assignment.id})" ${!canGive ? 'disabled' : ''} style="flex: 1;" aria-label="Give medication">
                            ${quickGiveMode[assignment.id] !== false ? 'Quick Give' : 'Give Medication'}
                        </button>
                    </div>
                    <button class="btn btn-secondary btn-small" onclick="viewHistory(${assignment.id})" aria-label="View administration history">History</button>
                    <button class="btn btn-primary btn-small" onclick="editAssignment(${assignment.id})" aria-label="Edit assignment">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="stopAssignment(${assignment.id})" aria-label="Stop assignment">Stop Assignment</button>
                </div>
            </div>
        `;
    }).join('');

    // Start timers for each assignment
    assignmentsWithStatus.forEach(({ assignment, status }) => {
        if (status && !status.can_administer) {
            startStatusTimer(assignment.id, async () => {
                const updatedStatus = await getAssignmentStatus(assignment.id);
                updateAssignmentStatus(assignment.id, updatedStatus);
            });
        }
    });
}

function updateAssignmentStatus(assignmentId, status) {
    const card = document.getElementById(`assignment-${assignmentId}`);
    if (!card) return;

    const statusBadge = card.querySelector('.status-badge');
    const giveButton = card.querySelector('.btn-success');
    
    if (status) {
        const statusClass = status.status || 'ready';
        card.className = `card assignment-card status-${statusClass}`;
        statusBadge.className = `status-badge status-${statusClass}`;
        
        if (status.can_administer) {
            if (status.status === 'overdue') {
                statusBadge.textContent = 'Overdue - Give now';
            } else {
                statusBadge.textContent = 'Ready to give';
            }
            if (giveButton) giveButton.disabled = false;
        } else if (status.time_until_next) {
            statusBadge.textContent = `Available in ${formatTimeUntilNext(status.time_until_next)}`;
            if (giveButton) giveButton.disabled = true;
        }
        
        // Update timer text
        const timerDivs = card.querySelectorAll('.timer');
        if (timerDivs.length > 0 && status.time_until_next) {
            timerDivs[0].textContent = `Next dose: ${formatTimeUntilNext(status.time_until_next)}`;
            if (status.frequency_type === 'range' && status.time_until_max && timerDivs.length > 1) {
                timerDivs[1].textContent = `Max time: ${formatTimeUntilNext(status.time_until_max)}`;
            }
        }
    }
}

function formatSchedule(assignment) {
    if (!assignment.schedule_type) return '';
    
    if (assignment.schedule_type === 'daily') {
        return `Daily at ${assignment.schedule_time || ''}`;
    } else if (assignment.schedule_type === 'weekly') {
        const days = assignment.schedule_days ? assignment.schedule_days.split(',') : [];
        return `Weekly: ${days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')} at ${assignment.schedule_time || ''}`;
    }
    return '';
}

window.giveMedication = async function(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    await showGiveMedicationForm(assignment);
};

window.toggleQuickGiveMode = function(assignmentId) {
    const toggle = document.getElementById(`quick-give-toggle-${assignmentId}`);
    if (toggle) {
        quickGiveMode[assignmentId] = toggle.checked;
        // Update button text
        const button = toggle.closest('.give-medication-control')?.querySelector('.btn-success');
        if (button) {
            button.textContent = toggle.checked ? 'Quick Give' : 'Give Medication';
        }
    }
};

window.giveMedicationWithMode = async function(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showToast('Assignment not found', 'error');
        return;
    }
    
    // Check if medication can be given
    const status = await getAssignmentStatus(assignmentId);
    if (!status || !status.can_administer) {
        showToast('Medication is not ready to be given yet', 'error');
        return;
    }
    
    // Use quick give if mode is enabled (defaults to true if not set)
    if (quickGiveMode[assignmentId] !== false) {
        const success = await quickGiveMedication(assignment);
        if (success) {
            // Reload dashboard to update status
            if (window.loadDashboard) {
                await window.loadDashboard();
            }
        }
    } else {
        // Use regular form
        await showGiveMedicationForm(assignment);
    }
};

window.quickGive = async function(assignmentId) {
    // Legacy function for backwards compatibility
    await window.giveMedicationWithMode(assignmentId);
};

window.viewHistory = async function(assignmentId) {
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
            // Store assignment ID for filtering
            window.currentHistoryFilter = { assignment_id: assignmentId };
            await window.loadHistory();
        }
    }
};

window.editAssignment = async function(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showToast('Assignment not found', 'error');
        return;
    }
    await showEditAssignmentForm(assignment);
};

window.stopAssignment = async function(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showToast('Assignment not found', 'error');
        return;
    }
    await showStopAssignmentDialog(assignment);
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

