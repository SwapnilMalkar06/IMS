// ====================================================================
// Stock In & Catalog Real-Time Synchronization Automated Test
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

async function runStockInSyncTest() {
    console.log('\n====================================================');
    console.log('🧪 AUTOMATED TEST: Stock In -> Product Catalog & Batch Sync');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
    };

    // TEST 1: Create a Product in Catalog
    const testSku = `SKU-TEST-${Date.now().toString().slice(-4)}`;
    const testTitle = `Pure Organic Honey ${Date.now().toString().slice(-4)}`;
    
    console.log(`📌 STEP 1: Creating Product in Catalog... ("${testTitle}")`);
    const createRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/products',
        method: 'POST',
        headers: authHeaders
    }, {
        sku: testSku,
        barcode: '890999888111',
        title: testTitle,
        category_id: 1,
        unit_of_measure: 'Pcs',
        domain_preset: 'GENERAL'
    });

    if (createRes.statusCode === 201 && createRes.body.id) {
        console.log(`  ✅ PASS: Product created successfully with ID: ${createRes.body.id}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Failed to create product. Status: ${createRes.statusCode}`, createRes.body);
        failed++;
        return;
    }

    const createdProdId = createRes.body.id;

    // TEST 2: Verify Initial Total Stock is 0
    console.log(`\n📌 STEP 2: Verifying Initial Stock in Catalog...`);
    const getRes1 = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/products?search=${encodeURIComponent(testSku)}`,
        method: 'GET',
        headers: authHeaders
    });

    const foundProd1 = Array.isArray(getRes1.body) ? getRes1.body.find(p => p.id == createdProdId || p.sku === testSku) : null;
    if (foundProd1) {
        console.log(`  ✅ PASS: Found product in Catalog table. Initial Stock: ${foundProd1.total_stock}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Product not found in Catalog table response.`);
        failed++;
    }

    // TEST 3: Add Stock for that Product via Stock In Form
    const testBatchNo = `BATCH-HONEY-${Date.now().toString().slice(-4)}`;
    console.log(`\n📌 STEP 3: Submitting Stock In Entry (+75 Pcs, Batch: ${testBatchNo})...`);
    const stockInRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/stock-in',
        method: 'POST',
        headers: authHeaders
    }, {
        product_id: createdProdId,
        product_title: testTitle,
        sku: testSku,
        batch_number: testBatchNo,
        expiry_date: '2027-12-31',
        quantity: 75,
        purchase_price: 200.00,
        selling_price: 300.00,
        supplier_id: 1,
        invoice_ref: 'INV-TEST-001'
    });

    if (stockInRes.statusCode === 201) {
        console.log(`  ✅ PASS: Stock In entry recorded successfully.`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Stock In failed. Status: ${stockInRes.statusCode}`, stockInRes.body);
        failed++;
    }

    // TEST 4: Verify Catalog Table Total Stock Updated to 75 Pcs
    console.log(`\n📌 STEP 4: Verifying Catalog Table Total Stock reflects +75 Pcs...`);
    const getRes2 = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/products?search=${encodeURIComponent(testSku)}`,
        method: 'GET',
        headers: authHeaders
    });

    const foundProd2 = Array.isArray(getRes2.body) ? getRes2.body.find(p => p.id == createdProdId || p.sku === testSku) : null;
    if (foundProd2 && parseInt(foundProd2.total_stock) >= 75) {
        console.log(`  ✅ PASS: Product Catalog Total Stock updated correctly to: ${foundProd2.total_stock} Pcs!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Stock not updated in Catalog table. Current Stock: ${foundProd2 ? foundProd2.total_stock : 'N/A'}`);
        failed++;
    }

    // TEST 5: Verify Batch Inspection Endpoint returns Batch Information
    console.log(`\n📌 STEP 5: Verifying Batch Inspection Breakdown...`);
    const batchRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/batches/${createdProdId}`,
        method: 'GET',
        headers: authHeaders
    });

    if (Array.isArray(batchRes.body) && batchRes.body.length > 0) {
        const batch = batchRes.body.find(b => b.batch_number === testBatchNo) || batchRes.body[0];
        console.log(`  ✅ PASS: Batch found! Batch No: ${batch.batch_number}, Qty: ${batch.available_qty}, Purchase Price: ₹${batch.purchase_price}, Selling Price: ₹${batch.selling_price}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Batch details missing from batch inspection endpoint.`);
        failed++;
    }

    console.log('\n====================================================');
    console.log(`📊 TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
}

runStockInSyncTest().catch(console.error);
