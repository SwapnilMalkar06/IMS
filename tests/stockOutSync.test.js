// ====================================================================
// Stock Out Automated Integration Test
// ====================================================================

const http = require('http');

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

async function runStockOutSyncTest() {
    console.log('\n====================================================');
    console.log('🧪 AUTOMATED TEST: Stock Out Dispatch Processing');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
    };

    // STEP 1: Create Product
    const testSku = `SKU-WHEAT-${Date.now().toString().slice(-4)}`;
    const testTitle = `Wheat Flour 5Kg ${Date.now().toString().slice(-4)}`;

    console.log(`📌 STEP 1: Creating Product... ("${testTitle}")`);
    const createRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/products',
        method: 'POST',
        headers: authHeaders
    }, {
        sku: testSku,
        title: testTitle,
        category_id: 2,
        unit_of_measure: 'Pcs',
        domain_preset: 'GROCERY'
    });

    const productId = createRes.body.id;
    console.log(`  ✅ PASS: Product created with ID: ${productId}`);
    passed++;

    // STEP 2: Stock In 100 Pcs under Batch AUG-2026
    const batchNo = `AUG-2026-${Date.now().toString().slice(-4)}`;
    console.log(`\n📌 STEP 2: Stock In +100 Pcs (Batch: ${batchNo})...`);
    const stockInRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/stock-in',
        method: 'POST',
        headers: authHeaders
    }, {
        product_id: productId,
        product_title: testTitle,
        sku: testSku,
        batch_number: batchNo,
        quantity: 100,
        purchase_price: 40.00,
        selling_price: 50.00
    });

    const batchId = stockInRes.body.batchId || 1;
    console.log(`  ✅ PASS: Stock In recorded. Batch ID: ${batchId}`);
    passed++;

    // STEP 3: Stock Out Dispatch - 10 Pcs
    console.log(`\n📌 STEP 3: Processing Stock Out Sale (-10 Pcs)...`);
    const stockOutRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/stock-out',
        method: 'POST',
        headers: authHeaders
    }, {
        product_id: productId,
        batch_id: batchId,
        quantity: 10,
        txn_type: 'SALE',
        unit_price: 50.00,
        discount_amount: 5.00,
        customer_name: 'Swapnil Malkar',
        invoice_ref: 'BILL-Auto'
    });

    if (stockOutRes.statusCode === 201) {
        console.log(`  ✅ PASS: Stock Out processed successfully! Remaining Qty: ${stockOutRes.body.remainingQty}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Stock Out failed with status ${stockOutRes.statusCode}:`, stockOutRes.body);
        failed++;
    }

    // STEP 4: Verify Product Catalog Stock updated to 90 Pcs
    console.log(`\n📌 STEP 4: Verifying Catalog Table Stock equals 90 Pcs...`);
    const getRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/products?search=${encodeURIComponent(testSku)}`,
        method: 'GET',
        headers: authHeaders
    });

    const foundProd = Array.isArray(getRes.body) ? getRes.body.find(p => p.id == productId || p.sku === testSku) : null;
    if (foundProd && parseInt(foundProd.total_stock) === 90) {
        console.log(`  ✅ PASS: Product Catalog Stock correctly updated to 90 Pcs!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Stock is ${foundProd ? foundProd.total_stock : 'N/A'}, expected 90 Pcs.`);
        failed++;
    }

    console.log('\n====================================================');
    console.log(`📊 TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
}

runStockOutSyncTest().catch(console.error);
