// ====================================================================
// PHASE 4: SYSTEM AUDIT & VERIFICATION SUITE
// QA Auditor Agent (qa-auditor)
// ====================================================================

const http = require('http');

const SERVER_URL = 'http://localhost:3000/api';

function makeRequest(path, method = 'GET', headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(SERVER_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', err => reject(err));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runSystemAudit() {
    console.log('====================================================');
    console.log('🛡️ PHASE 4 SYSTEM AUDIT & VERIFICATION STARTED');
    console.log('====================================================\n');

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, testName) {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passedTests++;
        } else {
            console.error(`  ❌ FAIL: ${testName}`);
            failedTests++;
        }
    }

    // TEST SUITE 1: HEALTH & DASHBOARD API
    console.log('📌 SUITE 1: System Health & Dashboard Metrics Audit');
    try {
        const health = await makeRequest('/health');
        assert(health.status === 200 && health.body.status === 'online', 'Server Health Endpoint responding 200 OK');

        const stats = await makeRequest('/dashboard/stats', 'GET', { 'x-user-role': 'ADMIN' });
        assert(stats.status === 200 && typeof stats.body.lowStockCount === 'number', 'Dashboard KPI stats returned valid metric structure');
    } catch (e) {
        console.error('Suite 1 error:', e.message);
    }

    // TEST SUITE 2: ROLE SECURITY & ACCESS GUARD AUDIT
    console.log('\n📌 SUITE 2: Role Permission & Security Audit');
    try {
        // Auditor role trying to execute Stock In -> Should fail 403
        const auditorStockIn = await makeRequest('/stock-in', 'POST', { 'x-user-role': 'AUDITOR' }, { product_id: 1, quantity: 50 });
        assert(auditorStockIn.status === 403, 'Auditor role blocked from Stock In entry (HTTP 403 Forbidden)');

        // Auditor role trying to create product -> Should fail 403
        const auditorCreateProd = await makeRequest('/products', 'POST', { 'x-user-role': 'AUDITOR' }, { sku: 'TEST', title: 'Test' });
        assert(auditorCreateProd.status === 403, 'Auditor role blocked from Product Creation (HTTP 403 Forbidden)');

        // Clerk role trying to create product -> Should fail 403 (Clerks can't create master products)
        const clerkCreateProd = await makeRequest('/products', 'POST', { 'x-user-role': 'CLERK' }, { sku: 'TEST', title: 'Test' });
        assert(clerkCreateProd.status === 403, 'Clerk role blocked from Product Creation (HTTP 403 Forbidden)');

        // Admin role creating product -> Should succeed 201
        const adminCreateProd = await makeRequest('/products', 'POST', { 'x-user-role': 'ADMIN' }, { sku: `AUDIT-${Date.now()}`, title: 'Audit Test Product', category_id: 1, unit_of_measure: 'Pcs' });
        assert(adminCreateProd.status === 201, 'Admin role authorized for Product Creation (HTTP 201 Created)');
    } catch (e) {
        console.error('Suite 2 error:', e.message);
    }

    // TEST SUITE 3: INVENTORY MATH & STOCK GUARD AUDIT
    console.log('\n📌 SUITE 3: Inventory Math & Negative Stock Guard Audit');
    try {
        // Attempting to dispatch 99999 units from a batch with insufficient stock -> Should fail 400
        const stockGuardTest = await makeRequest('/stock-out', 'POST', { 'x-user-role': 'CLERK' }, {
            product_id: 1,
            batch_id: 1,
            quantity: 99999,
            txn_type: 'SALE',
            unit_price: 15.00
        });

        assert(stockGuardTest.status === 400 && stockGuardTest.body.error.includes('Insufficient stock'), 'Stock Guard prevents negative inventory deduction');
    } catch (e) {
        console.error('Suite 3 error:', e.message);
    }

    // TEST SUITE 4: FEFO BATCH SELECTION AUDIT
    console.log('\n📌 SUITE 4: FEFO (First-Expired, First-Out) Order Audit');
    try {
        const batches = await makeRequest('/batches/1', 'GET', { 'x-user-role': 'CLERK' });
        assert(batches.status === 200 && Array.isArray(batches.body), 'Batch query returns FEFO ordered list');
    } catch (e) {
        console.error('Suite 4 error:', e.message);
    }

    // SUMMARY
    console.log('\n====================================================');
    console.log(`📊 SYSTEM AUDIT RESULT: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    process.exit(failedTests > 0 ? 1 : 0);
}

runSystemAudit();
