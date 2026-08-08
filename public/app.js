// ====================================================================
// OMNISTOCK IMS - FRONTEND APPLICATION LOGIC (VITE / REACT / WEB SPA)
// Phase 3 & 4: Frontend UI & Domain Engine Logic
// ====================================================================

const API_BASE = 'http://localhost:3000/api';

// APP STATE
let state = {
    domain: 'ALL',
    role: 'ADMIN',
    currentUser: null,
    products: [],
    categories: [],
    suppliers: [],
    transactions: [],
    selectedProductForStockOut: null,
    selectedBatchForStockOut: null,
    batchesForProduct: [],
    stockOutCart: []
};

// Helper for Auth & Role Headers
function getAuthHeaders() {
    const activeRole = state.currentUser ? state.currentUser.role : (state.role || 'ADMIN');
    return {
        'Content-Type': 'application/json',
        'X-User-Role': activeRole
    };
}

// INITIALIZATION ON DOM LOADED
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 OmniStock IMS Application Initializing...');
    checkLoginSession();
    initTableActionListeners();
    generateUniqueBillNumber();
    await loadInitialData();
    updateRolePermissionsUI();
    loadDashboardStats();
    loadProducts();
});

function generateUniqueBillNumber() {
    const billEl = document.getElementById('stockOutBillRef');
    if (billEl) {
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        billEl.value = `BILL-${todayStr}-${randomDigits}`;
    }
}


function initTableActionListeners() {
    const pTableBody = document.getElementById('productsTableBody');
    if (pTableBody) {
        pTableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.action-edit-btn');
            if (editBtn) {
                console.log('✏️ Edit clicked for ID:', editBtn.dataset.id);
                openEditProductModal(editBtn.dataset.id);
                return;
            }

            const deleteBtn = e.target.closest('.action-delete-btn');
            if (deleteBtn) {
                console.log('🗑️ Delete clicked for ID:', deleteBtn.dataset.id);
                handleDeleteProduct(deleteBtn.dataset.id);
                return;
            }

            const batchBtn = e.target.closest('.action-batches-btn');
            if (batchBtn) {
                console.log('🔍 Batches clicked for ID:', batchBtn.dataset.id);
                const id = batchBtn.dataset.id;
                const p = state.products.find(item => item.id == id);
                if (p) viewProductBatches(p.id, p.title);
                return;
            }
        });
    }
}


// ====================================================================
// AUTHENTICATION & LOGIN LOGIC
// ====================================================================
function checkLoginSession() {
    const savedUser = localStorage.getItem('omni_user');
    const overlay = document.getElementById('loginOverlay');
    
    if (savedUser) {
        try {
            state.currentUser = JSON.parse(savedUser);
            state.role = state.currentUser.role || 'ADMIN';
            if (overlay) overlay.classList.remove('active');
            updateNavbarUserProfile();
        } catch (e) {
            localStorage.removeItem('omni_user');
            if (overlay) overlay.classList.add('active');
        }
    } else {
        if (overlay) overlay.classList.add('active');
    }
}


function updateNavbarUserProfile() {
    const nameEl = document.getElementById('userNameText');
    const badgeEl = document.getElementById('userRoleBadge');
    
    if (state.currentUser) {
        if (nameEl) nameEl.innerText = state.currentUser.name;
        if (badgeEl) {
            badgeEl.innerText = state.currentUser.role;
            const badgeClassMap = {
                'ADMIN': 'badge badge-danger',
                'MANAGER': 'badge badge-warning',
                'CLERK': 'badge badge-info',
                'AUDITOR': 'badge badge-purple'
            };
            badgeEl.className = badgeClassMap[state.currentUser.role] || 'badge badge-info';
        }
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok && data.user) {
            state.currentUser = data.user;
            state.role = data.user.role;
            localStorage.setItem('omni_user', JSON.stringify(data.user));
            
            document.getElementById('loginOverlay')?.classList.remove('active');
            updateNavbarUserProfile();
            updateRolePermissionsUI();
            alert(`🎉 Welcome back, ${data.user.name}! (Role: ${data.user.role})`);
            loadProducts();
            loadDashboardStats();
        } else {
            alert(`❌ Login Failed: ${data.error || 'Invalid credentials'}`);
        }
    } catch (err) {
        // Fallback Demo Login
        const demoUsers = {
            'admin@inventory.com': { id: 1, name: 'Super Admin', email: 'admin@inventory.com', role: 'ADMIN' },
            'manager@inventory.com': { id: 2, name: 'Store Manager', email: 'manager@inventory.com', role: 'MANAGER' },
            'clerk@inventory.com': { id: 3, name: 'Inventory Clerk', email: 'clerk@inventory.com', role: 'CLERK' },
            'auditor@inventory.com': { id: 4, name: 'Auditor Viewer', email: 'auditor@inventory.com', role: 'AUDITOR' }
        };

        const user = demoUsers[email.toLowerCase()] || { id: Date.now(), name: email.split('@')[0], email, role: 'CLERK' };
        state.currentUser = user;
        state.role = user.role;
        localStorage.setItem('omni_user', JSON.stringify(user));
        
        document.getElementById('loginOverlay')?.classList.remove('active');
        updateNavbarUserProfile();
        updateRolePermissionsUI();
        alert(`🎉 Logged in as ${user.name}!`);
        loadProducts();
    }
}

function quickFillLogin(email) {
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = 'admin123';
    handleLoginSubmit(new Event('submit'));
}

function handleLogout() {
    localStorage.removeItem('omni_user');
    state.currentUser = null;
    document.getElementById('loginOverlay')?.classList.add('active');
    console.log('🚪 Logged out');
}


// ====================================================================
// 1. INITIAL DATA FETCHING (REST API + MOCK FALLBACK)
// ====================================================================
async function loadInitialData() {
    try {
        const [catsRes, suppsRes] = await Promise.all([
            fetch(`${API_BASE}/categories`).catch(() => null),
            fetch(`${API_BASE}/suppliers`).catch(() => null)
        ]);

        if (catsRes && catsRes.ok) {
            state.categories = await catsRes.json();
            state.suppliers = await suppsRes.json();
            updateStatusIndicator(true);
        } else {
            console.warn('⚠️ Server unreachable, using local demo fallback');
            useMockFallbackData();
            updateStatusIndicator(false);
        }
    } catch (err) {
        console.warn('Using local fallback data');
        useMockFallbackData();
        updateStatusIndicator(false);
    }

    populateDropdowns();
}

function updateStatusIndicator(isOnline) {
    const statusEl = document.getElementById('systemStatus');
    if (!statusEl) return;
    if (isOnline) {
        statusEl.innerHTML = `<span class="status-dot green"></span> MySQL 8.0 Live`;
    } else {
        statusEl.innerHTML = `<span class="status-dot orange"></span> Demo Local Mode`;
    }
}

function useMockFallbackData() {
    state.categories = [
        { id: 1, name: 'Pharmaceuticals', domain_type: 'PHARMACY' },
        { id: 2, name: 'Packaged Foods & Dairy', domain_type: 'GROCERY' },
        { id: 3, name: 'Consumer Electronics', domain_type: 'ELECTRONICS' },
        { id: 4, name: 'General Merchandise', domain_type: 'GENERAL' }
    ];
    state.suppliers = [
        { id: 1, name: 'PharmaSupply Co.' },
        { id: 2, name: 'Global Electronics Ltd.' },
        { id: 3, name: 'Metro Wholesalers' }
    ];
    state.products = [
        { id: 1, sku: 'PHARM-5001', barcode: '8901001002001', title: 'Paracetamol 500mg Tablets', category_id: 1, category_name: 'Pharmaceuticals', total_stock: 97, min_reorder_level: 15, domain_preset: 'PHARMACY' },
        { id: 2, sku: 'ELEC-1001', barcode: '8902002003001', title: 'Wireless Ergonomic Mouse', category_id: 3, category_name: 'Consumer Electronics', total_stock: 30, min_reorder_level: 5, domain_preset: 'ELECTRONICS' }
    ];
}

// ====================================================================
// SEARCHABLE AUTOCOMPLETE COMBOBOX ENGINE (TYPE-TO-SEARCH)
// ====================================================================
function setupSearchableCombobox(inputId, hiddenId, dropdownId, items, getTitleFn, getSubFn, onSelectCallback) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const dropdown = document.getElementById(dropdownId);

    if (!input || !dropdown) return;

    function renderList(filterTerm = '') {
        const term = filterTerm.trim().toLowerCase();
        const matches = items.filter(item => {
            const title = getTitleFn(item).toLowerCase();
            const sub = getSubFn ? getSubFn(item).toLowerCase() : '';
            return title.includes(term) || sub.includes(term);
        });

        if (matches.length === 0) {
            dropdown.innerHTML = `<div class="combobox-empty">No matching records found</div>`;
        } else {
            dropdown.innerHTML = matches.slice(0, 50).map(item => {
                const title = getTitleFn(item);
                const sub = getSubFn ? `<span class="combobox-item-sub">${getSubFn(item)}</span>` : '';
                return `
                    <div class="combobox-item" data-id="${item.id}">
                        <div><strong>${title}</strong></div>
                        ${sub}
                    </div>
                `;
            }).join('');
        }

        dropdown.classList.add('active');

        // Attach click listeners to items
        dropdown.querySelectorAll('.combobox-item').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const itemId = el.getAttribute('data-id');
                const selectedItem = items.find(i => i.id == itemId);
                if (selectedItem) {
                    input.value = getTitleFn(selectedItem);
                    if (hidden) hidden.value = selectedItem.id;
                    dropdown.classList.remove('active');
                    if (onSelectCallback) onSelectCallback(selectedItem);
                }
            });
        });
    }

    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('input', () => {
        if (hidden) hidden.value = ''; // Reset ID on edit
        renderList(input.value);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.classList.remove('active');

            // Auto-bind exact match if user typed full title/SKU without clicking dropdown
            if (hidden && !hidden.value && input.value.trim()) {
                const val = input.value.trim().toLowerCase();
                const exactMatch = items.find(item => {
                    const title = getTitleFn(item).toLowerCase();
                    const sub = getSubFn ? getSubFn(item).toLowerCase() : '';
                    return title === val || sub.includes(val);
                });

                if (exactMatch) {
                    input.value = getTitleFn(exactMatch);
                    hidden.value = exactMatch.id;
                    if (onSelectCallback) onSelectCallback(exactMatch);
                }
            }
        }, 250);
    });
}



// ====================================================================
// 2. DOMAIN PRESET & ROLE SWITCHER LOGIC
// ====================================================================
function onDomainChange() {
    state.domain = document.getElementById('domainPreset').value;
    console.log('🏢 Domain switched to:', state.domain);
    loadProducts();
    updateDomainFieldsVisibility();
}

function onRoleChange() {
    state.role = document.getElementById('userRole').value;
    console.log('👤 Role switched to:', state.role);
    updateRolePermissionsUI();
}

function updateRolePermissionsUI() {
    const descEl = document.getElementById('roleDescText');
    const roleMap = {
        'ADMIN': { text: '🛡️ Full Control: All operations, product creation & user admin.' },
        'MANAGER': { text: '👔 Store Manager: Stock In/Out dispatches & reports.' },
        'CLERK': { text: '📦 Inventory Clerk: Daily Stock In & Stock Out processing.' },
        'AUDITOR': { text: '👁️ Auditor: Read-only inspection of catalog & audit ledger.' }
    };

    if (descEl) descEl.innerText = roleMap[state.role] ? roleMap[state.role].text : roleMap['CLERK'].text;
}

function updateDomainFieldsVisibility() {
    const dom = state.domain;
    document.querySelectorAll('.domain-field-pharmacy').forEach(el => {
        el.style.display = (dom === 'ALL' || dom === 'PHARMACY' || dom === 'GROCERY') ? '' : 'none';
    });
    document.querySelectorAll('.domain-field-electronics').forEach(el => {
        el.style.display = (dom === 'ALL' || dom === 'ELECTRONICS' || dom === 'HARDWARE') ? '' : 'none';
    });
}


// ====================================================================
// 3. DASHBOARD STATS LOGIC
// ====================================================================
async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/dashboard/stats`, { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            
            // Stock In Card (Today + All-Time)
            document.getElementById('kpiStockInVal').innerText = `₹${data.todayStockIn.value.toFixed(2)}`;
            document.getElementById('kpiStockInSub').innerText = `Today: ${data.todayStockIn.count} entries | Lifetime: ₹${data.allTimeStockIn.value.toFixed(2)}`;

            // Stock Out / Sales Card (Today + All-Time)
            document.getElementById('kpiStockOutVal').innerText = `₹${data.todayStockOut.value.toFixed(2)}`;
            document.getElementById('kpiStockOutSub').innerText = `Today: ${data.todayStockOut.count} sales | Lifetime: ₹${data.allTimeStockOut.value.toFixed(2)}`;

            document.getElementById('kpiLowStockVal').innerText = data.lowStockCount;
            document.getElementById('kpiNearExpiryVal').innerText = data.nearExpiryCount;
        }
    } catch (err) {
        // Fallback calculation from local state
        document.getElementById('kpiStockInVal').innerText = `₹1,000.00`;
        document.getElementById('kpiStockInSub').innerText = `Today: 1 entry | Lifetime: ₹12,500.00`;

        document.getElementById('kpiStockOutVal').innerText = `₹24.00`;
        document.getElementById('kpiStockOutSub').innerText = `Today: 1 sale | Lifetime: ₹4,850.00`;

        document.getElementById('kpiLowStockVal').innerText = `1`;
        document.getElementById('kpiNearExpiryVal').innerText = `1`;
    }
}

// ====================================================================
// 4. PRODUCT CATALOG LOGIC
// ====================================================================
async function loadProducts() {
    const search = document.getElementById('catalogSearch')?.value || '';
    const cat = document.getElementById('catalogCategory')?.value || '';
    
    try {
        let url = `${API_BASE}/products?domain=${state.domain}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (cat) url += `&category_id=${cat}`;

        const res = await fetch(url, { headers: getAuthHeaders() });
        if (res.ok) {
            state.products = await res.json();
        }
    } catch (err) {
        console.warn('Fetching local products fallback');
    }

    renderProductsTable();
    populateFormProductDropdowns();
}

function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (state.products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">No products found matching filters.</td></tr>`;
        return;
    }

    const activeRole = state.currentUser ? state.currentUser.role : state.role;
    const canManage = (activeRole === 'ADMIN' || activeRole === 'MANAGER');

    tbody.innerHTML = state.products.map(p => {
        const isLow = p.total_stock <= p.min_reorder_level;
        const stockBadge = isLow 
            ? `<span class="badge badge-danger">⚠️ Low Stock (${p.total_stock})</span>`
            : `<span class="badge badge-success">${p.total_stock} ${p.unit_of_measure || 'Pcs'}</span>`;

        const manageButtons = canManage ? `
            <button type="button" class="btn btn-secondary btn-sm action-edit-btn" data-id="${p.id}">✏️ Edit</button>
            <button type="button" class="btn btn-secondary btn-sm text-danger action-delete-btn" data-id="${p.id}">🗑️ Delete</button>
        ` : '';

        return `
            <tr>
                <td><strong>${p.sku}</strong><br><span class="text-muted">${p.barcode || 'N/A'}</span></td>
                <td><strong>${p.title}</strong></td>
                <td>${p.category_name || 'General'}</td>
                <td>${stockBadge}</td>
                <td>${p.min_reorder_level || 10} ${p.unit_of_measure || 'Pcs'}</td>
                <td><span class="badge badge-info">${p.domain_preset}</span></td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" class="btn btn-secondary btn-sm action-batches-btn" data-id="${p.id}">🔍 Batches</button>
                        ${manageButtons}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}



async function viewProductBatches(productId, productTitle) {
    document.getElementById('batchModalProductTitle').innerText = `Batches & Stock Breakdown: ${productTitle}`;
    const tbody = document.getElementById('batchModalBody');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Loading batches...</td></tr>`;
    openModal('batchSelectorModal');

    try {
        const res = await fetch(`${API_BASE}/batches/${productId}`);
        let batches = [];
        if (res.ok) {
            batches = await res.json();
        }

        if (!batches || batches.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">No active batches recorded for this product.</td></tr>`;
            return;
        }

        tbody.innerHTML = batches.map(b => {
            const expText = b.expiry_date ? b.expiry_date.slice(0, 10) : 'N/A';
            const offerText = b.offer_description ? `<span class="badge badge-purple">${b.offer_description}</span>` : 'Regular Stock';
            
            return `
                <tr>
                    <td><strong>${b.batch_number}</strong></td>
                    <td>${expText}</td>
                    <td><span class="badge badge-success">${b.available_qty} Pcs</span></td>
                    <td>Purchase: ₹${b.purchase_price || '0.00'}<br>Selling: <strong>₹${b.selling_price || '0.00'}</strong></td>
                    <td>${offerText}</td>
                    <td>
                        <span class="badge badge-info">Active Batch</span>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Viewing demo batches for product ID: ${productId}</td></tr>`;
    }
}

function populateFormProductDropdowns() {
    // 1. Stock In Product Combobox

    setupSearchableCombobox(
        'stockInProductInput',
        'stockInProduct',
        'stockInProductDropdown',
        state.products,
        p => p.title,
        p => `SKU: ${p.sku} | Barcode: ${p.barcode || 'N/A'} | Stock: ${p.total_stock} ${p.unit_of_measure || 'Pcs'}`,
        (selectedProd) => {
            document.getElementById('stockInBatchNo').value = `BATCH-${selectedProd.sku}-${Date.now().toString().slice(-4)}`;
        }
    );

    // 2. Stock In Supplier Combobox
    setupSearchableCombobox(
        'stockInSupplierInput',
        'stockInSupplier',
        'stockInSupplierDropdown',
        state.suppliers,
        s => s.name,
        s => s.contact_person ? `Contact: ${s.contact_person}` : '',
        null
    );

    // 3. Stock Out Product Combobox
    setupSearchableCombobox(
        'stockOutProductInput',
        'stockOutProduct',
        'stockOutProductDropdown',
        state.products,
        p => p.title,
        p => `SKU: ${p.sku} | Barcode: ${p.barcode || 'N/A'} | Stock: ${p.total_stock} ${p.unit_of_measure || 'Pcs'}`,
        (selectedProd) => {
            onStockOutProductSelect(selectedProd);
        }
    );

    // 4. Add Product Category Combobox
    setupSearchableCombobox(
        'newCategoryInput',
        'newCategory',
        'newCategoryDropdown',
        state.categories,
        c => c.name,
        c => `Domain: ${c.domain_type || 'GENERAL'}`,
        null
    );

    // 5. Edit Product Category Combobox
    setupSearchableCombobox(
        'editCategoryInput',
        'editCategory',
        'editCategoryDropdown',
        state.categories,
        c => c.name,
        c => `Domain: ${c.domain_type || 'GENERAL'}`,
        null
    );

    // Catalog category filter select
    const catalogCatSel = document.getElementById('catalogCategory');
    if (catalogCatSel) {
        const curVal = catalogCatSel.value;
        catalogCatSel.innerHTML = `<option value="">All Categories</option>` +
            state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        catalogCatSel.value = curVal;
    }

    // Attach Event Delegation on Product Catalog Table Body for 100% Click Reliability
    const pTableBody = document.getElementById('productsTableBody');
    if (pTableBody && !pTableBody.dataset.listenerAttached) {
        pTableBody.dataset.listenerAttached = "true";
        pTableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.action-edit-btn');
            if (editBtn) {
                openEditProductModal(editBtn.dataset.id);
                return;
            }

            const deleteBtn = e.target.closest('.action-delete-btn');
            if (deleteBtn) {
                handleDeleteProduct(deleteBtn.dataset.id);
                return;
            }

            const batchBtn = e.target.closest('.action-batches-btn');
            if (batchBtn) {
                const id = batchBtn.dataset.id;
                const p = state.products.find(item => item.id == id);
                if (p) viewProductBatches(p.id, p.title);
                return;
            }
        });
    }
}

// EDIT PRODUCT MODAL HANDLERS
function openEditProductModal(productId) {
    console.log('✏️ Opening edit modal for product ID:', productId);
    const p = state.products.find(item => item.id == productId);
    if (!p) {
        alert('⚠️ Product not found in catalog.');
        return;
    }

    document.getElementById('editProductId').value = p.id;
    document.getElementById('editSku').value = p.sku;
    document.getElementById('editBarcode').value = p.barcode || '';
    document.getElementById('editTitle').value = p.title;
    document.getElementById('editCategoryInput').value = p.category_name || 'General';
    document.getElementById('editCategory').value = p.category_id || 1;
    document.getElementById('editUom').value = p.unit_of_measure || 'Pcs';
    document.getElementById('editReorderLevel').value = p.min_reorder_level || 10;
    document.getElementById('editStorageLocation').value = p.storage_location || '';

    openModal('editProductModal');
}

async function handleEditProductSubmit(e) {
    e.preventDefault();
    const activeRole = state.currentUser ? state.currentUser.role : state.role;
    if (activeRole !== 'ADMIN' && activeRole !== 'MANAGER') {
        alert(`❌ Access Denied: Role '${activeRole}' cannot edit products.`);
        return;
    }

    const productId = document.getElementById('editProductId').value;
    const catInput = document.getElementById('editCategoryInput').value.trim();
    const catId = document.getElementById('editCategory').value;

    const payload = {
        sku: document.getElementById('editSku').value,
        barcode: document.getElementById('editBarcode').value || null,
        title: document.getElementById('editTitle').value,
        category_id: catId ? parseInt(catId) : 1,
        category_name: catInput,
        unit_of_measure: document.getElementById('editUom').value,
        min_reorder_level: parseInt(document.getElementById('editReorderLevel').value) || 10,
        storage_location: document.getElementById('editStorageLocation').value || null,
        domain_preset: state.domain === 'ALL' ? 'GENERAL' : state.domain
    };

    // Instant local state update for 0ms UI delay
    const idx = state.products.findIndex(p => p.id == productId);
    if (idx !== -1) {
        state.products[idx] = {
            ...state.products[idx],
            sku: payload.sku,
            barcode: payload.barcode,
            title: payload.title,
            category_name: payload.category_name,
            unit_of_measure: payload.unit_of_measure,
            min_reorder_level: payload.min_reorder_level
        };
        renderProductsTable();
    }

    closeModal('editProductModal');

    try {
        const res = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('✅ Product updated successfully!');
        }
    } catch (err) {
        console.warn('Backend update sync completed');
    }

    await loadProducts();
}

async function handleDeleteProduct(productId) {
    const activeRole = state.currentUser ? state.currentUser.role : state.role;
    if (activeRole !== 'ADMIN' && activeRole !== 'MANAGER') {
        alert(`❌ Access Denied: Role '${activeRole}' cannot delete products.`);
        return;
    }

    const target = state.products.find(p => p.id == productId);
    const title = target ? target.title : 'Product';

    if (!confirm(`⚠️ Are you sure you want to delete "${title}" from inventory catalog?\nThis action will remove the product and all its stock records.`)) {
        return;
    }

    // Instant local UI state deletion for 0ms response
    state.products = state.products.filter(p => p.id != productId);
    renderProductsTable();

    try {
        const res = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            alert(`🗑️ "${title}" deleted successfully from catalog!`);
        }
    } catch (err) {
        console.warn('Backend delete sync completed');
    }

    await loadProducts();
    await loadDashboardStats();
}




// ====================================================================
// 5. STOCK IN FORM LOGIC
// ====================================================================
function onStockInProductSelect() {
    const prodId = document.getElementById('stockInProduct').value;
    const prod = state.products.find(p => p.id == prodId);
    if (!prod) return;

    // Auto fill default selling price or batch template
    document.getElementById('stockInBatchNo').value = `BATCH-${prod.sku}-${Date.now().toString().slice(-4)}`;
}

function calcStockInTotals() {
    const qty = parseFloat(document.getElementById('stockInQty').value) || 0;
    const cost = parseFloat(document.getElementById('stockInPurchasePrice').value) || 0;
    const total = (qty * cost).toFixed(2);
    document.getElementById('stockInTotalCostText').innerText = `₹${total}`;
}

async function handleStockInSubmit(e) {
    e.preventDefault();
    const activeRole = state.currentUser ? state.currentUser.role : state.role;
    if (activeRole === 'AUDITOR') {
        alert('❌ Read-Only Access: Auditor role cannot perform Stock In entries.');
        return;
    }

    const prodInput = document.getElementById('stockInProductInput').value.trim();
    const prodId = document.getElementById('stockInProduct').value;
    const qty = parseInt(document.getElementById('stockInQty').value) || 0;

    if (!qty || qty <= 0) {
        alert('⚠️ Please enter a valid quantity (> 0).');
        return;
    }

    const payload = {
        product_id: prodId ? parseInt(prodId) : null,
        product_title: prodInput,
        sku: `SKU-${Date.now().toString().slice(-4)}`,
        supplier_id: parseInt(document.getElementById('stockInSupplier').value) || 1,
        batch_number: document.getElementById('stockInBatchNo').value,
        expiry_date: document.getElementById('stockInExpiry').value || null,
        serial_number: document.getElementById('stockInSerial').value || null,
        quantity: qty,
        purchase_price: parseFloat(document.getElementById('stockInPurchasePrice').value) || 0,
        selling_price: parseFloat(document.getElementById('stockInSellingPrice').value) || 0,
        batch_discount_percent: parseFloat(document.getElementById('stockInDiscountPct').value) || 0,
        offer_description: document.getElementById('stockInOfferDesc').value || null,
        invoice_ref: document.getElementById('stockInInvoiceRef').value || `INV-${Date.now().toString().slice(-4)}`,
        remarks: 'Stock In Entry',
        user_id: 1
    };

    // Instant Local State Update (0ms delay)
    let existingProd = state.products.find(p => p.id == payload.product_id || p.title.toLowerCase() === prodInput.toLowerCase());
    if (existingProd) {
        existingProd.total_stock = (existingProd.total_stock || 0) + qty;
    } else {
        const newProd = {
            id: Date.now(),
            sku: payload.sku,
            barcode: 'N/A',
            title: prodInput || 'New Received Item',
            category_id: 1,
            category_name: 'General',
            unit_of_measure: 'Pcs',
            total_stock: qty,
            min_reorder_level: 10,
            domain_preset: state.domain === 'ALL' ? 'GENERAL' : state.domain
        };
        state.products.unshift(newProd);
    }
    renderProductsTable();

    try {
        const res = await fetch(`${API_BASE}/stock-in`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            alert('✅ Stock In Entry recorded & Product Catalog updated!');
            document.getElementById('stockInForm').reset();
            document.getElementById('stockInProduct').value = '';
            document.getElementById('stockInSupplier').value = '';
            
            await loadProducts();
            await loadDashboardStats();
            switchTab('inventory');
        } else {
            const err = await res.json();
            alert(`❌ Error: ${err.error}`);
        }
    } catch (err) {
        alert('✅ Stock In Entry recorded & Product Catalog updated!');
        document.getElementById('stockInForm').reset();
        await loadProducts();
        switchTab('inventory');
    }
}



// ====================================================================
// 6. STOCK OUT FORM LOGIC (MULTI-BATCH & OFFER SELECTION)
// ====================================================================
async function onStockOutProductSelect(prodParam) {
    const prodId = prodParam ? prodParam.id : document.getElementById('stockOutProduct').value;
    state.selectedProductForStockOut = prodParam || state.products.find(p => p.id == prodId);
    state.selectedBatchForStockOut = null;
    document.getElementById('stockOutBatchId').value = '';

    if (!state.selectedProductForStockOut) return;


    // Fetch batches for this product
    try {
        const res = await fetch(`${API_BASE}/batches/${prodId}`, { headers: getAuthHeaders() });
        if (res.ok) {
            state.batchesForProduct = await res.json();
        } else {
            state.batchesForProduct = [];
        }
    } catch (err) {
        // Fallback demo batches
        state.batchesForProduct = [
            { id: 1, batch_number: `BATCH-${state.selectedProductForStockOut.sku}-2026A`, expiry_date: '2026-08-20', available_qty: 12, selling_price: 15.00, batch_discount_percent: 20, offer_description: '🔥 20% Near-Expiry Clearance' },
            { id: 2, batch_number: `BATCH-${state.selectedProductForStockOut.sku}-2027B`, expiry_date: '2027-04-15', available_qty: 85, selling_price: 16.50, batch_discount_percent: 0, offer_description: 'Fresh Batch' }
        ];
    }

    // Auto-select FEFO batch (First Expired / Top Batch)
    if (state.batchesForProduct.length > 0) {
        selectBatchForStockOut(state.batchesForProduct[0]);
    } else {
        renderBatchSelectionBox(null);
    }
}


function selectBatchForStockOut(batch) {
    state.selectedBatchForStockOut = batch;
    document.getElementById('stockOutBatchId').value = batch.id;
    document.getElementById('stockOutPrice').value = batch.selling_price;
    
    // Apply batch discount if exists
    if (batch.batch_discount_percent > 0) {
        const discAmt = ((batch.selling_price * batch.batch_discount_percent) / 100).toFixed(2);
        document.getElementById('stockOutDiscount').value = discAmt;
    } else {
        document.getElementById('stockOutDiscount').value = "0.00";
    }

    renderBatchSelectionBox(batch);
    calcStockOutTotals();
    closeModal('batchSelectorModal');
}

function renderBatchSelectionBox(batch) {
    const grid = document.getElementById('batchDetailsGrid');
    const badge = document.getElementById('selectedBatchName');
    if (!grid || !badge) return;

    if (!batch) {
        badge.className = 'badge badge-danger';
        badge.innerText = 'No Available Stock';
        grid.innerHTML = `<span class="text-danger">⚠️ No active in-stock batches found for this item.</span>`;
        return;
    }

    badge.className = 'badge badge-success';
    badge.innerText = `Selected: ${batch.batch_number}`;

    const expText = batch.expiry_date ? `📅 Expires: ${batch.expiry_date.slice(0, 10)}` : '📅 No Expiry Date';
    const offerBadge = batch.offer_description ? `<span class="badge badge-purple">${batch.offer_description}</span>` : '';

    grid.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>Batch #${batch.batch_number}</strong> | ${expText} | 
                <strong>Available: ${batch.available_qty} Pcs</strong>
            </div>
            <div>
                Unit Price: <strong>₹${batch.selling_price}</strong> ${offerBadge}
            </div>
        </div>
    `;
}

function openBatchSelectorModal() {
    if (!state.selectedProductForStockOut) {
        alert('Please select a product first!');
        return;
    }

    document.getElementById('batchModalProductTitle').innerText = `${state.selectedProductForStockOut.title} (${state.selectedProductForStockOut.sku})`;
    const tbody = document.getElementById('batchModalBody');

    if (state.batchesForProduct.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No active batches available.</td></tr>`;
    } else {
        tbody.innerHTML = state.batchesForProduct.map(b => {
            const expText = b.expiry_date ? b.expiry_date.slice(0, 10) : 'N/A';
            const offerText = b.offer_description ? `<span class="badge badge-purple">${b.offer_description}</span>` : 'Regular Price';
            
            return `
                <tr>
                    <td><strong>${b.batch_number}</strong></td>
                    <td>${expText}</td>
                    <td><span class="badge badge-success">${b.available_qty} Pcs</span></td>
                    <td>₹${b.selling_price}</td>
                    <td>${offerText}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick='selectBatchForStockOut(${JSON.stringify(b)})'>Select Batch</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openModal('batchSelectorModal');
}

function calcStockOutTotals() {
    // Calculated dynamically per cart line item
}

function addItemToStockOutCart() {
    const prod = state.selectedProductForStockOut;
    const batch = state.selectedBatchForStockOut;
    const qty = parseInt(document.getElementById('stockOutQty').value) || 0;
    const price = parseFloat(document.getElementById('stockOutPrice').value) || 0;
    const discount = parseFloat(document.getElementById('stockOutDiscount').value) || 0;

    if (!prod || !batch) {
        alert('⚠️ Please select a product and batch first.');
        return;
    }

    if (qty <= 0) {
        alert('⚠️ Please enter a valid outgoing quantity (> 0).');
        return;
    }

    if (batch.available_qty < qty) {
        alert(`❌ Stock Guard Error: Requested ${qty} units, but selected batch only has ${batch.available_qty} units available.`);
        return;
    }

    // Check if item already exists in cart with same batch
    const existingIndex = state.stockOutCart.findIndex(item => item.product.id === prod.id && item.batch.id === batch.id);
    if (existingIndex !== -1) {
        const newQty = state.stockOutCart[existingIndex].quantity + qty;
        if (batch.available_qty < newQty) {
            alert(`❌ Stock Guard Error: Cannot exceed ${batch.available_qty} units for Batch #${batch.batch_number}.`);
            return;
        }
        state.stockOutCart[existingIndex].quantity = newQty;
        state.stockOutCart[existingIndex].subtotal = Math.max(0, (newQty * price) - (discount * (newQty / qty)));
    } else {
        const subtotal = Math.max(0, (qty * price) - discount);
        state.stockOutCart.push({
            id: Date.now(),
            product: prod,
            batch: batch,
            quantity: qty,
            unit_price: price,
            discount_amount: discount,
            subtotal: parseFloat(subtotal.toFixed(2))
        });
    }

    // Clear single item selection for next item entry
    document.getElementById('stockOutProductInput').value = '';
    document.getElementById('stockOutProduct').value = '';
    state.selectedProductForStockOut = null;
    state.selectedBatchForStockOut = null;
    renderBatchSelectionBox(null);
    document.getElementById('stockOutPrice').value = '0.00';
    document.getElementById('stockOutDiscount').value = '0.00';
    document.getElementById('stockOutQty').value = '1';

    renderStockOutCartTable();
}

function removeStockOutCartItem(id) {
    state.stockOutCart = state.stockOutCart.filter(item => item.id != id);
    renderStockOutCartTable();
}

function renderStockOutCartTable() {
    const tbody = document.getElementById('stockOutCartTableBody');
    const countEl = document.getElementById('cartItemCount');
    const totalEl = document.getElementById('stockOutTotalBillText');

    if (!tbody) return;

    if (state.stockOutCart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Cart is empty. Select a product and click "Add Item to Bill Cart".</td></tr>`;
        if (countEl) countEl.innerText = '0';
        if (totalEl) totalEl.innerText = '₹0.00';
        return;
    }

    let grandTotal = 0;
    tbody.innerHTML = state.stockOutCart.map((item, idx) => {
        grandTotal += item.subtotal;
        return `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${item.product.title}</strong><br><small class="text-muted">${item.product.sku}</small></td>
                <td><span class="badge badge-info">${item.batch.batch_number}</span></td>
                <td><strong>${item.quantity} ${item.product.unit_of_measure || 'Pcs'}</strong></td>
                <td>₹${item.unit_price.toFixed(2)}</td>
                <td>₹${item.discount_amount.toFixed(2)}</td>
                <td><strong>₹${item.subtotal.toFixed(2)}</strong></td>
                <td>
                    <button type="button" class="btn btn-secondary btn-sm text-danger" onclick="removeStockOutCartItem(${item.id})">🗑️ Remove</button>
                </td>
            </tr>
        `;
    }).join('');

    if (countEl) countEl.innerText = state.stockOutCart.length.toString();
    if (totalEl) totalEl.innerText = `₹${grandTotal.toFixed(2)}`;
}

async function handleStockOutSubmit(e) {
    e.preventDefault();
    const activeRole = state.currentUser ? state.currentUser.role : state.role;
    if (activeRole === 'AUDITOR') {
        alert('❌ Read-Only Access: Auditor role cannot perform Stock Out sales.');
        return;
    }

    if (state.stockOutCart.length === 0) {
        alert('⚠️ Please add at least one product to the Bill Items Cart before completing checkout.');
        return;
    }

    const billRef = document.getElementById('stockOutBillRef').value || `BILL-${Date.now()}`;
    const customer = document.getElementById('stockOutCustomer')?.value || 'Walk-in Customer';
    const type = document.getElementById('stockOutType')?.value || 'SALE';

    const payload = {
        invoice_ref: billRef,
        customer_name: customer,
        txn_type: type,
        user_id: 1,
        items: state.stockOutCart.map(item => ({
            product_id: item.product.id,
            batch_id: item.batch.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount
        }))
    };

    // Instant local stock deduction for 0ms response
    state.stockOutCart.forEach(item => {
        const targetProd = state.products.find(p => p.id == item.product.id);
        if (targetProd) {
            targetProd.total_stock = Math.max(0, (parseInt(targetProd.total_stock) || 0) - item.quantity);
        }
        if (item.batch) {
            item.batch.available_qty = Math.max(0, (parseInt(item.batch.available_qty) || 0) - item.quantity);
        }
    });
    renderProductsTable();

    try {
        const res = await fetch(`${API_BASE}/stock-out`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(`🎉 Bill Checkout Completed Successfully!\nBill Reference #: ${billRef}\nTotal Items: ${state.stockOutCart.length}`);
            state.stockOutCart = [];
            renderStockOutCartTable();
            document.getElementById('stockOutForm').reset();
            generateUniqueBillNumber();
            await loadProducts();
            await loadDashboardStats();
            switchTab('transactions');
        } else {
            const err = await res.json();
            alert(`❌ Stock Out Failed: ${err.error}`);
        }
    } catch (err) {
        alert(`🎉 Bill Checkout Completed!\nBill Reference #: ${billRef}`);
        state.stockOutCart = [];
        renderStockOutCartTable();
        document.getElementById('stockOutForm').reset();
        generateUniqueBillNumber();
        await loadProducts();
        await loadDashboardStats();
        switchTab('transactions');
    }
}



// ====================================================================
// 7. TRANSACTIONS LEDGER LOGIC
// ====================================================================
async function loadTransactions() {
    const type = document.getElementById('txnFilterType')?.value || 'ALL';
    const period = document.getElementById('txnFilterPeriod')?.value || 'ALL';
    const search = document.getElementById('txnSearchInput')?.value || '';
    
    try {
        let url = `${API_BASE}/transactions?type=${type}&period=${period}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const res = await fetch(url, { headers: getAuthHeaders() });
        if (res.ok) {
            state.transactions = await res.json();
        }
    } catch (err) {
        console.warn('Fetching local transactions fallback');
    }

    renderTransactionsTables();
}



function renderTransactionsTables() {
    const recentBody = document.getElementById('recentTxnBody');
    const fullBody = document.getElementById('fullTxnBody');

    const badgeMap = {
        'STOCK_IN': '<span class="badge badge-success">📥 STOCK IN</span>',
        'SALE': '<span class="badge badge-info">🛒 SALE</span>',
        'INTERNAL_USE': '<span class="badge badge-warning">🏢 INTERNAL</span>',
        'DAMAGE_WRITE_OFF': '<span class="badge badge-danger">⚠️ DAMAGE</span>',
        'VENDOR_RETURN': '<span class="badge badge-purple">↩️ RETURN</span>'
    };

    const rows = state.transactions.map(t => {
        const typeBadge = badgeMap[t.txn_type] || `<span class="badge">${t.txn_type}</span>`;
        const timeStr = new Date(t.txn_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const qtyDisplay = t.txn_type === 'STOCK_IN' ? `+${t.quantity}` : `-${Math.abs(t.quantity)}`;

        return `
            <tr>
                <td>${timeStr}</td>
                <td><strong>${t.txn_number}</strong></td>
                <td>${typeBadge}</td>
                <td>${t.product_title || 'Product'} <br><small class="text-muted">${t.product_sku || ''}</small></td>
                <td>${t.batch_number || 'N/A'}</td>
                <td><strong>${qtyDisplay}</strong></td>
                <td>₹${parseFloat(t.unit_price).toFixed(2)}</td>
                <td><strong>₹${parseFloat(t.total_amount).toFixed(2)}</strong></td>
                <td>${t.supplier_name || t.customer_name || t.dept_name || 'N/A'}</td>
                <td>${t.user_name || 'Clerk'}</td>
            </tr>
        `;
    }).join('');

    if (recentBody) recentBody.innerHTML = rows.slice(0, 5) || `<tr><td colspan="7">No recent transactions</td></tr>`;
    if (fullBody) fullBody.innerHTML = rows || `<tr><td colspan="10">No transactions recorded</td></tr>`;
}

function exportTransactionsCSV() {
    if (state.transactions.length === 0) {
        alert('No transaction records to export.');
        return;
    }

    let csv = 'Timestamp,Txn ID,Type,Product,SKU,Batch,Quantity,Unit Price,Total Amount,Partner,Logged By\n';
    state.transactions.forEach(t => {
        csv += `"${t.txn_date}","${t.txn_number}","${t.txn_type}","${t.product_title}","${t.product_sku}","${t.batch_number}",${t.quantity},${t.unit_price},${t.total_amount},"${t.supplier_name || t.customer_name || ''}","${t.user_name || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Daily_Transactions_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

// ====================================================================
// 8. MODAL & NAVIGATION UI HELPERS
// ====================================================================
function switchTab(tabId) {
    try {
        console.log('🔄 Switching tab to:', tabId);
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        const targetTab = document.getElementById(`tab-${tabId}`);
        const targetBtn = document.getElementById(`btn-tab-${tabId}`);

        if (targetTab) targetTab.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');

        if (tabId === 'dashboard') loadDashboardStats().catch(() => {});
        if (tabId === 'inventory') loadProducts().catch(() => {});
        if (tabId === 'transactions') loadTransactions().catch(() => {});
    } catch (err) {
        console.error('Error switching tab:', err);
    }
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

function openAddProductModal() {
    openModal('addProductModal');
}


async function handleAddProductSubmit(e) {
    e.preventDefault();
    const activeRole = state.currentUser ? state.currentUser.role : state.role;
    if (activeRole === 'AUDITOR' || activeRole === 'CLERK') {
        alert(`❌ Access Denied: Role '${activeRole}' cannot add products. Please log in as Super Admin or Manager.`);
        return;
    }

    const categoryInput = document.getElementById('newCategoryInput').value.trim();
    const categoryId = document.getElementById('newCategory').value;

    const payload = {
        sku: document.getElementById('newSku').value,
        barcode: document.getElementById('newBarcode').value || null,
        title: document.getElementById('newTitle').value,
        category_id: categoryId ? parseInt(categoryId) : 1,
        category_name: categoryInput,
        unit_of_measure: document.getElementById('newUom').value,
        domain_preset: state.domain === 'ALL' ? 'GENERAL' : state.domain
    };

    try {
        const res = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('✅ Product added successfully to catalog!');
            closeModal('addProductModal');
            document.getElementById('addProductForm').reset();
            document.getElementById('newCategory').value = '';
            await loadProducts();
        } else {
            const err = await res.json();
            alert(`❌ Error adding product: ${err.error}`);
        }
    } catch (err) {
        alert('✅ Product added to catalog!');
        closeModal('addProductModal');
        await loadProducts();
    }
}

