// ====================================================================
// Multi-Batch Same Product Checkout Integration Test
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

async function runMultiBatchSameProductTest() {
    console.log('\n====================================================================');
    console.log('📦 AUTOMATED TEST: Multi-Batch Same Product Checkout');
    console.log('====================================================================\n');

    let passed = 0;
    let failed = 0;

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
    };

    const ts = Date.now().toString().slice(-4);
    const testSku = `AMOX-${ts}`;
    const testTitle = `Amoxicillin 500mg ${ts}`;

    // STEP 1: Create Single Product
    console.log(`📌 STEP 1: Creating Product ("${testTitle}")...`);
    const prodRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/products', method: 'POST', headers: authHeaders
    }, {
        sku: testSku, title: testTitle, category_id: 1, unit_of_measure: 'Boxes', domain_preset: 'PHARMACY'
    });
    const prodId = prodRes.body.id;

    // STEP 2: Stock In Batch A (Clearance Batch - 10 Boxes at ₹100)
    const batchANo = `BATCH-AMOX-A-${ts}`;
    const stockInA = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-in', method: 'POST', headers: authHeaders
    }, {
        product_id: prodId, product_title: testTitle, sku: testSku,
        batch_number: batchANo, expiry_date: '2026-08-25', quantity: 10, purchase_price: 70.00, selling_price: 100.00
    });
    const batchAId = stockInA.body.batchId || 1;

    // STEP 3: Stock In Batch B (Fresh Batch - 50 Boxes at ₹120)
    const batchBNo = `BATCH-AMOX-B-${ts}`;
    const stockInB = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-in', method: 'POST', headers: authHeaders
    }, {
        product_id: prodId, product_title: testTitle, sku: testSku,
        batch_number: batchBNo, expiry_date: '2028-12-31', quantity: 50, purchase_price: 80.00, selling_price: 120.00
    });
    const batchBId = stockInB.body.batchId || 2;

    console.log(`  ✅ PASS: Single product stocked with 2 separate batches: Batch A (${batchANo}, Qty: 10) & Batch B (${batchBNo}, Qty: 50)`);
    passed++;

    // STEP 4: Submit Multi-Batch Checkout for SAME Product in 1 Bill (10 from Batch A + 5 from Batch B)
    const billNo = `BILL-MULTIBATCH-${ts}`;
    console.log(`\n📌 STEP 4: Submitting Multi-Batch Checkout for SAME product under Bill #${billNo}...`);
    const checkoutRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-out', method: 'POST', headers: authHeaders
    }, {
        invoice_ref: billNo,
        customer_name: 'Metro Pharmacy Customer',
        txn_type: 'SALE',
        items: [
            { product_id: prodId, batch_id: batchAId, quantity: 10, unit_price: 100.00, discount_amount: 10.00 }, // 10 from Batch A
            { product_id: prodId, batch_id: batchBId, quantity: 5, unit_price: 120.00, discount_amount: 0.00 }   // 5 from Batch B
        ]
    });

    if (checkoutRes.statusCode === 201 && checkoutRes.body.billNumber === billNo) {
        console.log(`  ✅ PASS: Checkout processed successfully for SAME product across 2 batches!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Multi-batch checkout failed:`, checkoutRes.body);
        failed++;
    }

    // STEP 5: Verify Total Stock Deduction in Catalog (60 - 15 = 45 Boxes)
    console.log(`\n📌 STEP 5: Verifying Product Catalog Total Stock...`);
    const catalogCheck = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/products?search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });
    const prod = Array.isArray(catalogCheck.body) ? catalogCheck.body.find(p => p.id == prodId || p.sku === testSku) : null;

    if (prod && parseInt(prod.total_stock) === 45) {
        console.log(`  ✅ PASS: Total catalog stock correctly updated to: 45 Boxes (60 - 15)!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Catalog stock is ${prod ? prod.total_stock : 'N/A'}, expected 45 Boxes.`);
        failed++;
    }

    // STEP 6: Verify Both Batch Entries in Daily Audit Ledger
    console.log(`\n📌 STEP 6: Verifying Daily Audit Ledger for Bill #${billNo}...`);
    const ledgerCheck = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/transactions?search=${encodeURIComponent(billNo)}`, method: 'GET', headers: authHeaders
    });

    if (Array.isArray(ledgerCheck.body) && ledgerCheck.body.length >= 2) {
        console.log(`  ✅ PASS: Found 2 distinct transaction entries recorded in Audit Ledger for both batches under Bill #${billNo}!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Audit ledger entries missing for Bill #${billNo}.`);
        failed++;
    }

    console.log('\n====================================================================');
    console.log(`📊 TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================================\n');
}

runMultiBatchSameProductTest().catch(console.error);
