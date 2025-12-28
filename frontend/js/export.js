/** Export and import functionality */
import { exportAPI } from './api.js';
import { showToast, showLoadingOverlay, hideLoadingOverlay, setButtonLoading } from './app.js';
import { loadDashboard } from './dashboard.js';
import { loadFamilyMembers } from './family-members.js';
import { loadCaregivers } from './caregivers.js';
import { loadMedications } from './medications.js';
import { loadInventory } from './inventory.js';

export function setupExportHandlers() {
    const exportJsonBtn = document.getElementById('export-json-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', async () => {
            setButtonLoading(exportJsonBtn, true);
            showLoadingOverlay('Exporting data...');
            try {
                await exportAPI.exportJSON();
                showToast('Data exported successfully', 'success');
            } catch (error) {
                showToast('Failed to export data', 'error');
                console.error(error);
            } finally {
                setButtonLoading(exportJsonBtn, false);
                hideLoadingOverlay();
            }
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', async () => {
            setButtonLoading(exportCsvBtn, true);
            showLoadingOverlay('Exporting data...');
            try {
                await exportAPI.exportCSV();
                showToast('Data exported successfully', 'success');
            } catch (error) {
                showToast('Failed to export data', 'error');
                console.error(error);
            } finally {
                setButtonLoading(exportCsvBtn, false);
                hideLoadingOverlay();
            }
        });
    }

    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!confirm('Importing will add data from the backup file. Continue?')) {
                importFile.value = '';
                return;
            }

            setButtonLoading(importBtn, true);
            showLoadingOverlay('Importing data...');
            try {
                const result = await exportAPI.importJSON(file);
                showToast(`Import completed: ${JSON.stringify(result.imported)}`, 'success');
                importFile.value = '';
                
                // Reload all data
                showLoadingOverlay('Reloading data...');
                await Promise.all([
                    loadDashboard(),
                    loadFamilyMembers(),
                    loadCaregivers(),
                    loadMedications(),
                    loadInventory()
                ]);
            } catch (error) {
                showToast(`Import failed: ${error.message}`, 'error');
                console.error(error);
                importFile.value = '';
            } finally {
                setButtonLoading(importBtn, false);
                hideLoadingOverlay();
            }
        });
    }
}

