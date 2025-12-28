/** Dashboard view with medication assignments and status */
import { assignmentsAPI } from './api.js';
import { getAssignmentStatus, formatTimeUntilNext, startStatusTimer, stopStatusTimer, showGiveMedicationForm } from './administrations.js';
import { showToast } from './app.js';
import { showEditAssignmentForm } from './assignments.js';

let assignments = [];

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
        container.innerHTML = '<div class="empty-state"><p>No active medication assignments. Assign medications to family members to get started!</p></div>';
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
                    <button class="btn btn-success btn-small" onclick="giveMedication(${assignment.id})" ${!canGive ? 'disabled' : ''}>
                        Give Medication
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="viewHistory(${assignment.id})">History</button>
                    <button class="btn btn-primary btn-small" onclick="editAssignment(${assignment.id})">Edit</button>
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

