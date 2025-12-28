/** Main application controller */
import { loadFamilyMembers } from './family-members.js';
import { loadCaregivers } from './caregivers.js';
import { loadMedications } from './medications.js';
import { loadDashboard } from './dashboard.js';
import { loadInventory } from './inventory.js';
import { showAssignMedicationForm, loadInactiveAssignments } from './assignments.js';
import { administrationsAPI } from './api.js';
import { setupExportHandlers } from './export.js';
import { stopAllTimers } from './administrations.js';

// Make functions available globally
window.loadDashboard = loadDashboard;
window.loadFamilyMembers = loadFamilyMembers;
window.loadCaregivers = loadCaregivers;
window.loadMedications = loadMedications;
window.loadInventory = loadInventory;

let currentView = 'dashboard';

// Hamburger Menu
function setupHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mainNav = document.getElementById('main-nav');
    
    if (hamburgerBtn && mainNav) {
        const toggleMenu = () => {
            const isActive = mainNav.classList.toggle('active');
            hamburgerBtn.classList.toggle('active', isActive);
            hamburgerBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        };
        
        hamburgerBtn.addEventListener('click', toggleMenu);
        
        // Keyboard support for hamburger menu
        hamburgerBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleMenu();
            } else if (e.key === 'Escape' && mainNav.classList.contains('active')) {
                toggleMenu();
                hamburgerBtn.focus();
            }
        });
        
        // Close menu when clicking a nav button on mobile
        const navButtons = mainNav.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Only close on mobile (when hamburger is visible)
                if (window.innerWidth < 768) {
                    hamburgerBtn.classList.remove('active');
                    mainNav.classList.remove('active');
                    hamburgerBtn.setAttribute('aria-expanded', 'false');
                }
            });
        });
        
        // Close menu when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 768 && 
                mainNav.classList.contains('active') &&
                !mainNav.contains(e.target) &&
                !hamburgerBtn.contains(e.target)) {
                hamburgerBtn.classList.remove('active');
                mainNav.classList.remove('active');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

// Navigation
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
}

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('active');
        b.removeAttribute('aria-current');
    });
    
    // Show selected view
    const view = document.getElementById(`${viewName}-view`);
    const btn = document.querySelector(`[data-view="${viewName}"]`);
    
    if (view) {
        view.classList.add('active');
        view.setAttribute('aria-hidden', 'false');
    }
    if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page');
    }
    
    currentView = viewName;
    
    // Announce view change to screen readers
    announceToScreenReader(`Navigated to ${viewName} view`);
    
    // Load view-specific data
    switch(viewName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'medications':
            loadMedications();
            break;
        case 'family':
            loadFamilyMembers();
            break;
        case 'history':
            loadHistory();
            break;
        case 'settings':
            // Load caregivers, inventory, and inactive assignments when settings view is opened
            loadCaregivers();
            loadInventory();
            loadInactiveAssignments();
            break;
    }
}

// History view
async function loadHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading history...</p></div>';

    try {
        const params = {};
        
        // Get filter values
        const familyFilter = document.getElementById('history-family-filter');
        const medicationFilter = document.getElementById('history-medication-filter');
        const startDate = document.getElementById('history-start-date');
        const endDate = document.getElementById('history-end-date');
        
        if (familyFilter?.value) params.family_member_id = familyFilter.value;
        if (medicationFilter?.value) params.medication_id = medicationFilter.value;
        if (startDate?.value) params.start_date = startDate.value;
        if (endDate?.value) params.end_date = endDate.value;
        
        // Use stored filter if available
        if (window.currentHistoryFilter) {
            Object.assign(params, window.currentHistoryFilter);
            window.currentHistoryFilter = null;
        }
        
        const administrations = await administrationsAPI.getAll(params);
        
        if (administrations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;">📋</div>
                    <h3 style="margin-bottom: 0.5rem; color: var(--text-color);">No Administration Records</h3>
                    <p style="color: #666; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
                        ${Object.keys(params).length > 0 
                            ? 'No records match your current filters. Try adjusting your filters or select different dates.' 
                            : 'When you record medication administrations from the dashboard, they will appear here with full history and details.'}
                    </p>
                </div>
            `;
            return;
        }
        
        // Group by date (convert UTC to local time)
        const grouped = {};
        administrations.forEach(admin => {
            // Ensure UTC datetime is properly parsed and converted to local time
            let adminDate;
            if (typeof admin.administered_at === 'string') {
                // If it's a string, ensure it's treated as UTC if it doesn't have timezone info
                const dateStr = admin.administered_at;
                if (dateStr.endsWith('Z')) {
                    adminDate = new Date(dateStr);
                } else if (dateStr.includes('+') || dateStr.includes('-', 10)) {
                    // Has timezone info
                    adminDate = new Date(dateStr);
                } else {
                    // No timezone info, assume UTC and append Z
                    adminDate = new Date(dateStr + (dateStr.includes('T') ? 'Z' : ''));
                }
            } else {
                adminDate = new Date(admin.administered_at);
            }
            const date = adminDate.toLocaleDateString();
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push({ ...admin, _localDate: adminDate });
        });
        
        container.innerHTML = Object.entries(grouped).map(([date, admins]) => `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">${date}</div>
                </div>
                <div class="card-body">
                    ${admins.map(admin => {
                        const medName = admin.assignment?.medication?.name || 'Unknown';
                        const memberName = admin.assignment?.family_member?.name || 'Unknown';
                        const caregiverName = admin.caregiver?.name || null;
                        // Use the pre-parsed local date
                        const localTime = admin._localDate ? admin._localDate.toLocaleTimeString() : new Date(admin.administered_at).toLocaleTimeString();
                        return `
                        <div style="padding: 0.5rem 0; border-bottom: 1px solid #eee;">
                            <p><strong>${escapeHtml(medName)}</strong> - ${escapeHtml(memberName)}</p>
                            <p>Dose: ${escapeHtml(admin.dose_given)} at ${localTime}</p>
                            ${caregiverName ? `<p><em>Given by: ${escapeHtml(caregiverName)}</em></p>` : ''}
                            ${admin.notes ? `<p><em>${escapeHtml(admin.notes)}</em></p>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load history. Please try again.</p></div>';
        console.error(error);
    }
}

window.loadHistory = loadHistory;

// Edit administration function
window.editAdministration = async function(administrationId) {
    const { administrationsAPI } = await import('./api.js');
    
    try {
        const admin = await administrationsAPI.get(administrationId);
        if (!admin) {
            showToast('Administration not found', 'error');
            return;
        }
        
        await showEditAdministrationForm(admin);
    } catch (error) {
        showToast('Failed to load administration details', 'error');
        console.error(error);
    }
};

async function showEditAdministrationForm(admin) {
    const { caregiversAPI } = await import('./api.js');
    
    // Load caregivers for dropdown
    let caregivers = [];
    try {
        caregivers = await caregiversAPI.getAll();
    } catch (error) {
        console.error('Failed to load caregivers', error);
    }
    
    // Convert UTC ISO datetime to local datetime-local format
    // The API returns UTC time, so we need to convert it to local time for display/editing
    const adminDate = new Date(admin.administered_at);
    // Get local time components
    const year = adminDate.getFullYear();
    const month = String(adminDate.getMonth() + 1).padStart(2, '0');
    const day = String(adminDate.getDate()).padStart(2, '0');
    const hours = String(adminDate.getHours()).padStart(2, '0');
    const minutes = String(adminDate.getMinutes()).padStart(2, '0');
    const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    const medName = admin.assignment?.medication?.name || 'Unknown';
    const memberName = admin.assignment?.family_member?.name || 'Unknown';
    
    const content = `
        <h3>Edit Administration</h3>
        <div class="medication-info" style="margin-bottom: 1rem; padding: 0.5rem; background: var(--bg-color); border-radius: 4px;">
            <p><strong>${escapeHtml(medName)}</strong></p>
            <p>For: ${escapeHtml(memberName)}</p>
        </div>
        <form id="edit-administration-form">
            <div class="form-group">
                <label for="edit-admin-time">Administration Time</label>
                <input type="datetime-local" id="edit-admin-time" value="${localDateTime}" required>
            </div>
            <div class="form-group">
                <label for="edit-admin-dose">Dose Given</label>
                <input type="text" id="edit-admin-dose" value="${escapeHtml(admin.dose_given)}" required>
            </div>
            <div class="form-group">
                <label for="edit-admin-caregiver">Given By (optional)</label>
                <select id="edit-admin-caregiver">
                    <option value="">Select caregiver</option>
                    ${caregivers.map(c => `<option value="${c.id}" ${admin.caregiver_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="edit-admin-notes">Notes (optional)</label>
                <textarea id="edit-admin-notes">${escapeHtml(admin.notes || '')}</textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal(content);
    
    document.getElementById('edit-administration-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        setButtonLoading(submitButton, true);
        
        try {
            const { administrationsAPI } = await import('./api.js');
            
            const dateTimeInput = document.getElementById('edit-admin-time').value;
            const doseGiven = document.getElementById('edit-admin-dose').value.trim();
            const caregiverId = document.getElementById('edit-admin-caregiver').value;
            const notes = document.getElementById('edit-admin-notes').value.trim() || null;
            
            // Convert datetime-local (which is in local time) to UTC ISO string
            // datetime-local input gives us a string like "2024-01-15T14:30" in local time
            // We need to create a Date object treating it as local time, then convert to UTC
            const localDate = new Date(dateTimeInput);
            // Validate the date was parsed correctly
            if (isNaN(localDate.getTime())) {
                showToast('Invalid date/time format', 'error');
                setButtonLoading(submitButton, false);
                return;
            }
            // Convert to UTC ISO string - toISOString() automatically converts to UTC
            const isoDateTime = localDate.toISOString();
            
            // Validate not in future (using local time for user-friendly check)
            if (localDate > new Date()) {
                showToast('Administration time cannot be in the future', 'error');
                setButtonLoading(submitButton, false);
                return;
            }
            
            const data = {
                administered_at: isoDateTime,
                dose_given: doseGiven,
                caregiver_id: caregiverId ? parseInt(caregiverId) : null,
                notes: notes
            };
            
            await administrationsAPI.update(admin.id, data);
            showToast('Administration updated successfully', 'success');
            closeModal();
            // Reload history
            if (window.loadHistory) {
                await window.loadHistory();
            }
        } catch (error) {
            const errorMsg = error.message || 'Failed to update administration';
            showToast(errorMsg, 'error');
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

// Populate history filters
async function populateHistoryFilters() {
    const [familyMembers, medications] = await Promise.all([
        loadFamilyMembers(),
        loadMedications()
    ]);
    
    const familyFilter = document.getElementById('history-family-filter');
    const medicationFilter = document.getElementById('history-medication-filter');
    
    if (familyFilter) {
        familyFilter.innerHTML = '<option value="">All Family Members</option>' +
            familyMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    }
    
    if (medicationFilter) {
        medicationFilter.innerHTML = '<option value="">All Medications</option>' +
            medications.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    }
}

// Screen reader announcements
export function announceToScreenReader(message) {
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) {
        liveRegion.textContent = message;
        // Clear after announcement
        setTimeout(() => {
            liveRegion.textContent = '';
        }, 1000);
    }
}

// Store the element that had focus before modal opened
let previousActiveElement = null;

// Modal functions
export function showModal(content) {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    
    if (overlay && modalContent) {
        // Store the currently focused element
        previousActiveElement = document.activeElement;
        
        modalContent.innerHTML = content;
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        
        // Set modal title for aria-labelledby
        const modalTitle = modalContent.querySelector('h3');
        if (modalTitle && !modalTitle.id) {
            modalTitle.id = 'modal-title';
            overlay.setAttribute('aria-labelledby', 'modal-title');
        }
        
        // Focus the first focusable element in the modal
        setTimeout(() => {
            const firstFocusable = overlay.querySelector('button:not(.modal-close), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                firstFocusable.focus();
            } else {
                // If no focusable element, focus the modal itself
                overlay.focus();
            }
        }, 100);
        
        // Trap focus within modal
        trapFocus(overlay);
    }
}

export function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        
        // Remove focus trap handler
        if (focusTrapHandler) {
            overlay.removeEventListener('keydown', focusTrapHandler);
            focusTrapHandler = null;
        }
        
        // Return focus to the element that opened the modal
        if (previousActiveElement) {
            previousActiveElement.focus();
            previousActiveElement = null;
        }
    }
}

// Focus trap for modal
let focusTrapHandler = null;

function trapFocus(modal) {
    // Remove previous handler if exists
    if (focusTrapHandler) {
        modal.removeEventListener('keydown', focusTrapHandler);
    }
    
    const focusableElements = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    focusTrapHandler = function handleTab(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            return;
        }
        
        if (e.key !== 'Tab') {
            return;
        }
        
        if (focusableElements.length === 0) {
            e.preventDefault();
            return;
        }
        
        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable?.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable?.focus();
            }
        }
    };
    
    modal.addEventListener('keydown', focusTrapHandler);
}

// Make closeModal available globally for onclick handlers
window.closeModal = closeModal;

// Toast notifications
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    
    container.appendChild(toast);
    
    // Announce to screen reader
    announceToScreenReader(message);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Loading overlay functions
let loadingOverlay = null;

export function showLoadingOverlay(message = 'Loading...') {
    if (loadingOverlay) {
        hideLoadingOverlay();
    }
    
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="spinner"></div>
        <p>${escapeHtml(message)}</p>
    `;
    
    document.body.appendChild(loadingOverlay);
}

export function hideLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.remove();
        loadingOverlay = null;
    } else {
        const existing = document.getElementById('loading-overlay');
        if (existing) {
            existing.remove();
        }
    }
}

// Helper function to set button loading state
export function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('btn-loading');
    } else {
        button.disabled = false;
        button.classList.remove('btn-loading');
    }
}

// Helper function to show delete confirmation with dependency warnings
export async function showDeleteConfirmation(itemType, itemName, canDeleteCheck, onConfirm) {
    try {
        const checkResult = await canDeleteCheck();
        
        if (!checkResult.can_delete) {
            // Show warning dialog with dependency details
            let warningMessage = `<p><strong>Cannot delete ${itemType}: "${escapeHtml(itemName)}"</strong></p>`;
            warningMessage += '<p style="color: var(--danger-color); margin-top: 1rem;">This item cannot be deleted because it has dependencies:</p>';
            
            if (itemType === 'medication') {
                // For medications, check for all assignments (active and inactive) and inventory
                const assignments = checkResult.assignments || checkResult.active_assignments || [];
                const hasInventory = checkResult.has_inventory || false;
                
                if (assignments.length > 0) {
                    const activeCount = assignments.filter(a => a.active === true).length;
                    const inactiveCount = assignments.length - activeCount;
                    
                    warningMessage += '<ul style="margin: 1rem 0; padding-left: 1.5rem;">';
                    assignments.forEach(assignment => {
                        const status = assignment.active === false ? ' (inactive)' : '';
                        warningMessage += `<li>Assigned to: <strong>${escapeHtml(assignment.family_member_name)}${status}</strong></li>`;
                    });
                    warningMessage += '</ul>';
                    
                    if (inactiveCount > 0) {
                        warningMessage += `<p><em>This medication has ${assignments.length} assignment(s) (${activeCount} active, ${inactiveCount} inactive). Please remove all assignments before deleting.</em></p>`;
                    } else {
                        warningMessage += '<p><em>Please remove or deactivate these assignments before deleting.</em></p>';
                    }
                }
                
                if (hasInventory) {
                    if (assignments.length > 0) {
                        warningMessage += '<p style="margin-top: 1rem;"><strong>This medication also has inventory records.</strong></p>';
                    } else {
                        warningMessage += '<p style="margin-top: 1rem;"><strong>This medication has inventory records.</strong></p>';
                    }
                    warningMessage += '<p><em>Please delete the inventory record before deleting the medication.</em></p>';
                }
            } else if (checkResult.active_assignments && checkResult.active_assignments.length > 0) {
                // For family members, show active assignments
                warningMessage += '<ul style="margin: 1rem 0; padding-left: 1.5rem;">';
                checkResult.active_assignments.forEach(assignment => {
                    warningMessage += `<li>Medication: <strong>${escapeHtml(assignment.medication_name)}</strong></li>`;
                });
                warningMessage += '</ul>';
                warningMessage += '<p><em>Please remove or deactivate these assignments before deleting.</em></p>';
            } else if (checkResult.administration_count !== undefined && checkResult.administration_count > 0) {
                warningMessage += `<p><strong>${checkResult.administration_count} administration record(s)</strong> have been recorded for this caregiver.</p>`;
                warningMessage += '<p><em>Cannot delete caregiver with recorded administrations.</em></p>';
            }
            
            const content = `
                <h3>Cannot Delete ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}</h3>
                <div class="alert alert-danger" style="margin: 1rem 0;">
                    ${warningMessage}
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            `;
            
            showModal(content);
            return false;
        }
        
        // No dependencies, show standard confirmation
        const confirmMessage = `Are you sure you want to delete ${itemType} "${itemName}"?`;
        if (confirm(confirmMessage)) {
            // Execute onConfirm without catching errors here - let the callback handle them
            // The callback will show appropriate error messages and handle the error
            await onConfirm();
            return true;
        }
        return false;
    } catch (error) {
        // Only catch errors from canDeleteCheck, not from onConfirm
        // onConfirm errors are already handled by the callbacks and should not be re-thrown
        showToast(`Failed to check deletion status: ${error.message}`, 'error');
        console.error(error);
        return false;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggle(savedTheme);
}

function toggleTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
}

function updateThemeToggle(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.checked = theme === 'dark';
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupNavigation();
    setupExportHandlers();
    setupHamburgerMenu();
    
    // Setup modal close
    const modalClose = document.querySelector('.modal-close');
    const modalOverlay = document.getElementById('modal-overlay');
    
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
    
    // Setup history filter button
    const historyFilterBtn = document.getElementById('history-filter-btn');
    if (historyFilterBtn) {
        historyFilterBtn.addEventListener('click', loadHistory);
    }
    
    // Populate filters when history view is accessed
    document.querySelector('[data-view="history"]')?.addEventListener('click', populateHistoryFilters);
    
    // Add "Assign Medication" button to dashboard
    const dashboardView = document.getElementById('dashboard-view');
    if (dashboardView) {
        const assignBtn = document.createElement('button');
        assignBtn.className = 'btn btn-primary';
        assignBtn.textContent = 'Assign Medication';
        assignBtn.onclick = showAssignMedicationForm;
        dashboardView.insertBefore(assignBtn, dashboardView.querySelector('#assignments-list'));
    }
    
    // Setup theme toggle switch
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
    }
    
    // Load initial view
    switchView('dashboard');
});

// Make theme functions available globally
window.toggleTheme = toggleTheme;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAllTimers();
});

