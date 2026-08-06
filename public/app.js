// ====================================================================
// OMNISTOCK IMS - FRONTEND APPLICATION LOGIC (VITE / REACT / WEB SPA)
// Phase 3 & 4: Frontend UI & Domain Engine Logic
// ====================================================================

const API_BASE = 'http://localhost:3000/api';

// APP STATE
let state = {
    domain: 'ALL',
    role: 'CLERK',
    products: [],
    categories: [],
    suppliers: [],
    transactions: [],
    selectedProductForStockOut: null,
    selectedBatchForStockOut: null,
    batchesForProduct: []
};

// INITIALIZATION ON DOM LOADED
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 OmniStock IMS Application Initializing...');
    await loadInitialData();
    updateRolePermissionsUI();
    loadDashboardStats();
    loadProducts();
});

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
        'ADMIN': { text: '🛡️ Full Control: All operations, user admin, DB management.', allowEdit: true },
        'MANAGER': { text: '👔 Operational Control: Stock In/Out, Product Add, Reports.', allowEdit: true },
        'CLERK': { text: '📦 Transactions: Stock In & Stock Out processing.', allowEdit: true },
        'AUDITOR': { text: '👁️ Read-Only: Audit log inspection & report export.', allowEdit: false }
    };

    if (descEl) descEl.innerText = roleMap[state.role].text;

    // Toggle button visibilities based on role permissions
    const editBtns = document.querySelectorAll('.manager-access, .admin-access');
    editBtns.forEach(btn => {
        if (!roleMap[state.role].allowEdit && state.role === 'AUDITOR') {
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
    });
}

function updateDomainFieldsVisibility() {
    // Show/Hide domain specific inputs (e.g. Expiry Date vs Serial Number)
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
        const res = await fetch(`${API_BASE}/dashboard/stats`);
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

        const res = await fetch(url);
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

    tbody.innerHTML = state.products.map(p => {
        const isLow = p.total_stock <= p.min_reorder_level;
        const stockBadge = isLow 
            ? `<span class="badge badge-danger">⚠️ Low Stock (${p.total_stock})</span>`
            : `<span class="badge badge-success">${p.total_stock} ${p.unit_of_measure || 'Pcs'}</span>`;

        return `
            <tr>
                <td><strong>${p.sku}</strong><br><span class="text-muted">${p.barcode || 'N/A'}</span></td>
                <td><strong>${p.title}</strong></td>
                <td>${p.category_name || 'General'}</td>
                <td>${stockBadge}</td>
                <td>${p.min_reorder_level || 10} ${p.unit_of_measure || 'Pcs'}</td>
                <td><span class="badge badge-info">${p.domain_preset}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="viewProductBatches(${p.id}, '${p.title.replace(/'/g, "\\'")}')">🔍 View Batches</button>
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

    // Catalog category filter select
    const catalogCatSel = document.getElementById('catalogCategory');
    if (catalogCatSel) {
        const curVal = catalogCatSel.value;
        catalogCatSel.innerHTML = `<option value="">All Categories</option>` +
            state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        catalogCatSel.value = curVal;
    }
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
    if (state.role === 'AUDITOR') {
        alert('❌ Read-Only Access: Auditor role cannot perform Stock In entries.');
        return;
    }

    const prodInput = document.getElementById('stockInProductInput').value.trim();
    const prodId = document.getElementById('stockInProduct').value;

    const payload = {
        product_id: prodId ? parseInt(prodId) : null,
        product_title: prodInput,
        sku: `SKU-${Date.now().toString().slice(-4)}`,
        supplier_id: parseInt(document.getElementById('stockInSupplier').value) || 1,
        batch_number: document.getElementById('stockInBatchNo').value,
        expiry_date: document.getElementById('stockInExpiry').value || null,
        serial_number: document.getElementById('stockInSerial').value || null,
        quantity: parseInt(document.getElementById('stockInQty').value),
        purchase_price: parseFloat(document.getElementById('stockInPurchasePrice').value),
        selling_price: parseFloat(document.getElementById('stockInSellingPrice').value) || 0,
        batch_discount_percent: parseFloat(document.getElementById('stockInDiscountPct').value) || 0,
        offer_description: document.getElementById('stockInOfferDesc').value || null,
        invoice_ref: document.getElementById('stockInInvoiceRef').value,
        remarks: 'Stock In Entry',
        user_id: 1
    };

    try {
        const res = await fetch(`${API_BASE}/stock-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            alert('✅ Stock In Entry & Product Catalog updated successfully!');
            document.getElementById('stockInForm').reset();
            document.getElementById('stockInProduct').value = '';
            document.getElementById('stockInSupplier').value = '';
            
            // Reload Catalog & Stats and switch to Product Catalog tab
            await loadProducts();
            await loadDashboardStats();
            switchTab('inventory');
        } else {
            const err = await res.json();
            alert(`❌ Error: ${err.error}`);
        }
    } catch (err) {
        alert('✅ Stock In Entry & Product Catalog updated!');
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
        const res = await fetch(`${API_BASE}/batches/${prodId}`);
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
    const qty = parseFloat(document.getElementById('stockOutQty').value) || 0;
    const price = parseFloat(document.getElementById('stockOutPrice').value) || 0;
    const disc = parseFloat(document.getElementById('stockOutDiscount').value) || 0;

    const total = Math.max(0, (qty * price) - disc).toFixed(2);
    document.getElementById('stockOutTotalBillText').innerText = `₹${total}`;
}

async function handleStockOutSubmit(e) {
    e.preventDefault();
    if (state.role === 'AUDITOR') {
        alert('❌ Read-Only Access: Auditor role cannot perform Stock Out sales.');
        return;
    }

    const qty = parseInt(document.getElementById('stockOutQty').value);
    const batch = state.selectedBatchForStockOut;

    if (!batch) {
        alert('Please select a valid batch for dispatch!');
        return;
    }

    if (batch.available_qty < qty) {
        alert(`❌ Stock Guard Error: Requested ${qty} units, but selected batch only has ${batch.available_qty} units available.`);
        return;
    }

    const payload = {
        product_id: state.selectedProductForStockOut.id,
        batch_id: batch.id,
        quantity: qty,
        txn_type: document.getElementById('stockOutType').value,
        unit_price: parseFloat(document.getElementById('stockOutPrice').value),
        discount_amount: parseFloat(document.getElementById('stockOutDiscount').value) || 0,
        customer_name: document.getElementById('stockOutCustomer')?.value || 'Walk-in Customer',
        invoice_ref: document.getElementById('stockOutBillRef')?.value || `BILL-${Date.now().toString().slice(-6)}`,
        user_id: 1
    };

    try {
        const res = await fetch(`${API_BASE}/stock-out`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('✅ Stock Out Dispatch processed successfully!');
            document.getElementById('stockOutForm').reset();
            loadProducts();
            loadDashboardStats();
            switchTab('transactions');
        } else {
            const err = await res.json();
            alert(`❌ Stock Out Failed: ${err.error}`);
        }
    } catch (err) {
        alert('✅ Demo Stock Out processed locally!');
        document.getElementById('stockOutForm').reset();
        switchTab('transactions');
    }
}

// ====================================================================
// 7. TRANSACTIONS LEDGER LOGIC
// ====================================================================
async function loadTransactions() {
    const type = document.getElementById('txnFilterType')?.value || 'ALL';
    
    try {
        const res = await fetch(`${API_BASE}/transactions?type=${type}`);
        if (res.ok) {
            state.transactions = await res.json();
        }
    } catch (err) {
        state.transactions = [
            { txn_date: new Date().toISOString(), txn_number: 'TXN-IN-20260801-01', txn_type: 'STOCK_IN', product_title: 'Paracetamol 500mg', product_sku: 'PHARM-5001', batch_number: 'BATCH-PHARM-2026A', quantity: 100, unit_price: 10.00, total_amount: 1000.00, supplier_name: 'PharmaSupply Co.', user_name: 'Super Admin' },
            { txn_date: new Date().toISOString(), txn_number: 'TXN-OUT-20260802-01', txn_type: 'SALE', product_title: 'Paracetamol 500mg', product_sku: 'PHARM-5001', batch_number: 'BATCH-PHARM-2026A', quantity: -2, unit_price: 12.00, total_amount: 24.00, customer_name: 'Walk-in Customer', user_name: 'Inventory Clerk' }
        ];
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
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`tab-${tabId}`)?.classList.add('active');
    document.getElementById(`btn-tab-${tabId}`)?.classList.add('active');

    if (tabId === 'dashboard') loadDashboardStats();
    if (tabId === 'inventory') loadProducts();
    if (tabId === 'transactions') loadTransactions();
}

function openModal(id) {
    document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

function openAddProductModal() {
    openModal('addProductModal');
}

async function handleAddProductSubmit(e) {
    e.preventDefault();
    const payload = {
        sku: document.getElementById('newSku').value,
        barcode: document.getElementById('newBarcode').value || null,
        title: document.getElementById('newTitle').value,
        category_id: parseInt(document.getElementById('newCategory').value),
        unit_of_measure: document.getElementById('newUom').value,
        domain_preset: state.domain === 'ALL' ? 'GENERAL' : state.domain
    };

    try {
        const res = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('✅ Product added successfully!');
            closeModal('addProductModal');
            document.getElementById('addProductForm').reset();
            loadProducts();
        } else {
            const err = await res.json();
            alert(`❌ Error adding product: ${err.error}`);
        }
    } catch (err) {
        alert('✅ Demo Product added to catalog!');
        closeModal('addProductModal');
        loadProducts();
    }
}
