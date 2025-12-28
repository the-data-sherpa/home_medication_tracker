/** Medication inventory management */
import { inventoryAPI, medicationsAPI } from './api.js';
import { showToast, showModal, closeModal, setButtonLoading } from './app.js';

let inventory = [];
let medications = [];

export async function loadInventory() {
    const container = document.getElementById('inventory-list');
    if (container) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading inventory...</p></div>';
    }
    
    try {
        [inventory, medications] = await Promise.all([
            inventoryAPI.getAll(),
            medicationsAPI.getAll()
        ]);
        renderInventory();
        renderLowStockAlerts();
        return inventory;
    } catch (error) {
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load inventory. Please try again.</p></div>';
        }
        showToast('Failed to load inventory', 'error');
        console.error(error);
        return [];
    }
}

function renderLowStockAlerts() {
    const container = document.getElementById('low-stock-alerts');
    if (!container) return;

    const lowStock = inventory.filter(item => 
        item.low_stock_threshold && item.quantity <= item.low_stock_threshold
    );

    if (lowStock.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = lowStock.map(item => {
        const med = medications.find(m => m.id === item.medication_id);
        return `
            <div class="alert alert-warning">
                <strong>Low Stock:</strong> ${escapeHtml(med?.name || 'Unknown')} - 
                ${item.quantity} ${item.unit} remaining (threshold: ${item.low_stock_threshold} ${item.unit})
            </div>
        `;
    }).join('');
}

function renderInventory() {
    const container = document.getElementById('inventory-list');
    if (!container) return;

    if (inventory.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No inventory records yet. Add one to get started!</p></div>';
        return;
    }

    container.innerHTML = inventory.map(item => {
        const med = medications.find(m => m.id === item.medication_id);
        const isLowStock = item.low_stock_threshold && item.quantity <= item.low_stock_threshold;
        
        return `
            <div class="card ${isLowStock ? 'status-overdue' : ''}">
                <div class="card-header">
                    <div class="card-title">${escapeHtml(med?.name || 'Unknown')}</div>
                    ${isLowStock ? '<span class="status-badge status-overdue">Low Stock</span>' : ''}
                </div>
                <div class="card-body">
                    <p><strong>Quantity:</strong> ${item.quantity} ${item.unit}</p>
                    ${item.low_stock_threshold ? `<p><strong>Low Stock Threshold:</strong> ${item.low_stock_threshold} ${item.unit}</p>` : ''}
                    <p><strong>Last Updated:</strong> ${new Date(item.last_updated).toLocaleString()}</p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-secondary btn-small" onclick="editInventory(${item.id})">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="deleteInventory(${item.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

export function showAddInventoryForm() {
    if (medications.length === 0) {
        showToast('Please add medications first', 'error');
        return;
    }

    const content = `
        <h3>Add Inventory</h3>
        <form id="add-inventory-form">
            <div class="form-group">
                <label for="inv-medication">Medication</label>
                <select id="inv-medication" required>
                    <option value="">Select medication</option>
                    ${medications.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="inv-quantity">Quantity</label>
                <input type="number" id="inv-quantity" step="0.1" min="0" required>
            </div>
            <div class="form-group">
                <label for="inv-unit">Unit</label>
                <input type="text" id="inv-unit" placeholder="e.g., mL, tablets, capsules" required>
            </div>
            <div class="form-group">
                <label for="inv-threshold">Low Stock Threshold (optional)</label>
                <input type="number" id="inv-threshold" step="0.1" min="0" placeholder="Alert when quantity reaches this">
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Add</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal(content);
    
    document.getElementById('add-inventory-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        setButtonLoading(submitButton, true);
        
        try {
            const data = {
                medication_id: parseInt(document.getElementById('inv-medication').value),
                quantity: parseFloat(document.getElementById('inv-quantity').value),
                unit: document.getElementById('inv-unit').value.trim(),
                low_stock_threshold: document.getElementById('inv-threshold').value ? 
                    parseFloat(document.getElementById('inv-threshold').value) : null
            };
            
            await inventoryAPI.create(data);
            showToast('Inventory added successfully', 'success');
            closeModal();
            await loadInventory();
        } catch (error) {
            const errorMsg = error.message || 'Failed to add inventory';
            showToast(errorMsg, 'error');
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

window.editInventory = async function(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    const med = medications.find(m => m.id === item.medication_id);
    
    const content = `
        <h3>Edit Inventory</h3>
        <form id="edit-inventory-form">
            <div class="form-group">
                <label>Medication</label>
                <input type="text" value="${escapeHtml(med?.name || 'Unknown')}" disabled>
            </div>
            <div class="form-group">
                <label for="edit-inv-quantity">Quantity</label>
                <input type="number" id="edit-inv-quantity" value="${item.quantity}" step="0.1" min="0" required>
            </div>
            <div class="form-group">
                <label for="edit-inv-unit">Unit</label>
                <input type="text" id="edit-inv-unit" value="${escapeHtml(item.unit)}" required>
            </div>
            <div class="form-group">
                <label for="edit-inv-threshold">Low Stock Threshold (optional)</label>
                <input type="number" id="edit-inv-threshold" value="${item.low_stock_threshold || ''}" step="0.1" min="0">
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            </div>
        </form>
    `;
    
    showModal(content);
    
    document.getElementById('edit-inventory-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        setButtonLoading(submitButton, true);
        
        try {
            const data = {
                quantity: parseFloat(document.getElementById('edit-inv-quantity').value),
                unit: document.getElementById('edit-inv-unit').value.trim(),
                low_stock_threshold: document.getElementById('edit-inv-threshold').value ? 
                    parseFloat(document.getElementById('edit-inv-threshold').value) : null
            };
            
            await inventoryAPI.update(id, data);
            showToast('Inventory updated successfully', 'success');
            closeModal();
            await loadInventory();
        } catch (error) {
            const errorMsg = error.message || 'Failed to update inventory';
            showToast(errorMsg, 'error');
            console.error(error);
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
};

window.deleteInventory = async function(id) {
    if (!confirm('Are you sure you want to delete this inventory record?')) {
        return;
    }
    
    try {
        await inventoryAPI.delete(id);
        showToast('Inventory record deleted', 'success');
        await loadInventory();
    } catch (error) {
        const errorMsg = error.message || 'Failed to delete inventory record';
        showToast(errorMsg, 'error');
        console.error(error);
    }
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
        document.getElementById('add-inventory-btn')?.addEventListener('click', showAddInventoryForm);
    });
} else {
    document.getElementById('add-inventory-btn')?.addEventListener('click', showAddInventoryForm);
}

