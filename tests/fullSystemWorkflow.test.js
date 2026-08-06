// ====================================================================
// Comprehensive End-to-End System Workflow & Audit Ledger Test
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

async function runFullSystemWorkflowTest() {
    console.log('\n====================================================================');
    console.log('🛡️ COMPREHENSIVE END-TO-END SYSTEM WORKFLOW & AUDIT LEDGER TEST');
    console.log('====================================================================\n');

    let passed = 0;
    let failed = 0;

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
    };

    // --------------------------------------------------------------------
    // STEP 1: Add a Product to Product Catalog
    // --------------------------------------------------------------------
    const timestamp = Date.now().toString().slice(-4);
    const testSku = `PARA-${timestamp}`;
    const testTitle = `Paracetamol 650mg Tablets ${timestamp}`;

    console.log(`📌 STEP 1: Creating Product in Catalog... ("${testTitle}")`);
    const createRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/products', method: 'POST', headers: authHeaders
    }, {
        sku: testSku,
        barcode: `890${timestamp}1122`,
        title: testTitle,
        category_id: 1,
        unit_of_measure: 'Boxes',
        min_reorder_level: 20,
        domain_preset: 'PHARMACY'
    });

    if (createRes.statusCode === 201 && createRes.body.id) {
        console.log(`  ✅ PASS: Product created with ID: ${createRes.body.id}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Product creation failed. Status: ${createRes.statusCode}`, createRes.body);
        failed++;
        return;
    }

    const productId = createRes.body.id;

    // --------------------------------------------------------------------
    // STEP 2: Stock In Batch 1 (Near-Expiry Clearance Batch - Expires Aug 2026)
    // --------------------------------------------------------------------
    const batch1No = `BATCH-PARA-2026-${timestamp}`;
    console.log(`\n📌 STEP 2: Adding Stock for Batch 1 (Near-Expiry: ${batch1No}, +100 Boxes)...`);
    const stockIn1 = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-in', method: 'POST', headers: authHeaders
    }, {
        product_id: productId,
        product_title: testTitle,
        sku: testSku,
        batch_number: batch1No,
        expiry_date: '2026-08-30',
        quantity: 100,
        purchase_price: 8.00,
        selling_price: 12.00,
        batch_discount_percent: 20.0,
        offer_description: '🔥 20% Clearance Offer',
        supplier_id: 1,
        invoice_ref: `INV-IN1-${timestamp}`
    });

    const batch1Id = stockIn1.body.batchId || 1;
    if (stockIn1.statusCode === 201) {
        console.log(`  ✅ PASS: Batch 1 Stock In recorded (+100 Boxes, ID: ${batch1Id})`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Batch 1 Stock In failed.`, stockIn1.body);
        failed++;
    }

    // --------------------------------------------------------------------
    // STEP 3: Stock In Batch 2 (Fresh Stock Batch - Expires Jun 2028)
    // --------------------------------------------------------------------
    const batch2No = `BATCH-PARA-2028-${timestamp}`;
    console.log(`\n📌 STEP 3: Adding Stock for Batch 2 (Fresh Stock: ${batch2No}, +200 Boxes)...`);
    const stockIn2 = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-in', method: 'POST', headers: authHeaders
    }, {
        product_id: productId,
        product_title: testTitle,
        sku: testSku,
        batch_number: batch2No,
        expiry_date: '2028-06-30',
        quantity: 200,
        purchase_price: 9.00,
        selling_price: 15.00,
        batch_discount_percent: 0,
        supplier_id: 1,
        invoice_ref: `INV-IN2-${timestamp}`
    });

    const batch2Id = stockIn2.body.batchId || 2;
    if (stockIn2.statusCode === 201) {
        console.log(`  ✅ PASS: Batch 2 Stock In recorded (+200 Boxes, ID: ${batch2Id})`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Batch 2 Stock In failed.`, stockIn2.body);
        failed++;
    }

    // --------------------------------------------------------------------
    // STEP 4: Verify Catalog Total Stock equals 300 Boxes
    // --------------------------------------------------------------------
    console.log(`\n📌 STEP 4: Verifying Catalog Table Total Stock equals 300 Boxes (100 + 200)...`);
    const getRes1 = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/products?search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });

    const prod1 = Array.isArray(getRes1.body) ? getRes1.body.find(p => p.id == productId || p.sku === testSku) : null;
    if (prod1 && parseInt(prod1.total_stock) === 300) {
        console.log(`  ✅ PASS: Product Catalog Total Stock correctly equals: ${prod1.total_stock} Boxes!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Catalog Total Stock is ${prod1 ? prod1.total_stock : 'N/A'}, expected 300 Boxes.`);
        failed++;
    }

    // --------------------------------------------------------------------
    // STEP 5: Process Direct Sale to Customer (FEFO Batch 1 - 20 Boxes)
    // --------------------------------------------------------------------
    console.log(`\n📌 STEP 5: Processing Direct Sale to Customer (-20 Boxes from Batch 1)...`);
    const saleRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-out', method: 'POST', headers: authHeaders
    }, {
        product_id: productId,
        batch_id: batch1Id,
        quantity: 20,
        txn_type: 'SALE',
        unit_price: 12.00,
        discount_amount: 2.00,
        customer_name: 'Customer John Doe',
        invoice_ref: `BILL-SALE-${timestamp}`
    });

    if (saleRes.statusCode === 201) {
        console.log(`  ✅ PASS: Direct Sale processed successfully. Remaining Batch 1 Qty: ${saleRes.body.remainingQty}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Direct Sale failed.`, saleRes.body);
        failed++;
    }

    // --------------------------------------------------------------------
    // STEP 6: Process Internal Usage Dispatch (-10 Boxes)
    // --------------------------------------------------------------------
    console.log(`\n📌 STEP 6: Processing Internal Usage Dispatch (-10 Boxes)...`);
    const internalRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-out', method: 'POST', headers: authHeaders
    }, {
        product_id: productId,
        batch_id: batch1Id,
        quantity: 10,
        txn_type: 'INTERNAL_USE',
        unit_price: 12.00,
        dept_name: 'Emergency Ward Department',
        invoice_ref: `REQ-INT-${timestamp}`
    });

    if (internalRes.statusCode === 201) {
        console.log(`  ✅ PASS: Internal Usage processed. Remaining Batch 1 Qty: ${internalRes.body.remainingQty}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Internal Usage failed.`, internalRes.body);
        failed++;
    }

    // --------------------------------------------------------------------
    // STEP 7: Process Damaged / Expired Write-Off (-5 Boxes)
    // --------------------------------------------------------------------
    console.log(`\n📌 STEP 7: Processing Damaged / Expired Write-Off (-5 Boxes)...`);
    const damageRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-out', method: 'POST', headers: authHeaders
    }, {
        product_id: productId,
        batch_id: batch1Id,
        quantity: 5,
        txn_type: 'DAMAGE_WRITE_OFF',
        unit_price: 12.00,
        remarks: 'Water damage in storage bin A',
        invoice_ref: `DAM-${timestamp}`
    });

    if (damageRes.statusCode === 201) {
        console.log(`  ✅ PASS: Damaged Write-off processed. Remaining Batch 1 Qty: ${damageRes.body.remainingQty}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Damaged Write-off failed.`, damageRes.body);
        failed++;
    }

    // --------------------------------------------------------------------
    // STEP 8: Verify Catalog Total Stock equals 265 Boxes (300 - 20 - 10 - 5)
    // --------------------------------------------------------------------
    console.log(`\n📌 STEP 8: Verifying Catalog Table Stock equals 265 Boxes (300 - 35)...`);
    const getRes2 = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/products?search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });

    const prod2 = Array.isArray(getRes2.body) ? getRes2.body.find(p => p.id == productId || p.sku === testSku) : null;
    if (prod2 && parseInt(prod2.total_stock) === 265) {
        console.log(`  ✅ PASS: Product Catalog Stock correctly equals: ${prod2.total_stock} Boxes!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Catalog Stock is ${prod2 ? prod2.total_stock : 'N/A'}, expected 265 Boxes.`);
        failed++;
    }

    // --------------------------------------------------------------------
    // STEP 9: Test Daily Audit Ledger Filters
    // --------------------------------------------------------------------
    console.log(`\n📌 STEP 9: Testing Daily Audit Ledger Type & Date Filters...`);

    // 9a. Filter by Type: STOCK_IN
    const filterIn = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/transactions?type=STOCK_IN&search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });
    if (Array.isArray(filterIn.body) && filterIn.body.length >= 2) {
        console.log(`  ✅ PASS: Filter [STOCK_IN] returned ${filterIn.body.length} Stock In records.`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Filter [STOCK_IN] returned ${filterIn.body ? filterIn.body.length : 0} records.`);
        failed++;
    }

    // 9b. Filter by Type: SALE
    const filterSale = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/transactions?type=SALE&search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });
    if (Array.isArray(filterSale.body) && filterSale.body.length >= 1) {
        console.log(`  ✅ PASS: Filter [SALE] returned ${filterSale.body.length} Direct Sale record.`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Filter [SALE] returned ${filterSale.body ? filterSale.body.length : 0} records.`);
        failed++;
    }

    // 9c. Filter by Type: INTERNAL_USE
    const filterInternal = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/transactions?type=INTERNAL_USE&search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });
    if (Array.isArray(filterInternal.body) && filterInternal.body.length >= 1) {
        console.log(`  ✅ PASS: Filter [INTERNAL_USE] returned ${filterInternal.body.length} Internal Usage record.`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Filter [INTERNAL_USE] returned ${filterInternal.body ? filterInternal.body.length : 0} records.`);
        failed++;
    }

    // 9d. Filter by Type: DAMAGE_WRITE_OFF
    const filterDamage = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/transactions?type=DAMAGE_WRITE_OFF&search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });
    if (Array.isArray(filterDamage.body) && filterDamage.body.length >= 1) {
        console.log(`  ✅ PASS: Filter [DAMAGE_WRITE_OFF] returned ${filterDamage.body.length} Damaged record.`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Filter [DAMAGE_WRITE_OFF] returned ${filterDamage.body ? filterDamage.body.length : 0} records.`);
        failed++;
    }

    // 9e. Filter by Period: TODAY
    const filterToday = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/transactions?period=TODAY&search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });
    if (Array.isArray(filterToday.body) && filterToday.body.length >= 5) {
        console.log(`  ✅ PASS: Period Filter [TODAY] returned all ${filterToday.body.length} transactions created today.`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Period Filter [TODAY] returned ${filterToday.body ? filterToday.body.length : 0} records, expected >= 5.`);
        failed++;
    }

    // 9f. Filter by Period: THIS_YEAR
    const filterYear = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/transactions?period=THIS_YEAR&search=${encodeURIComponent(testSku)}`, method: 'GET', headers: authHeaders
    });
    if (Array.isArray(filterYear.body) && filterYear.body.length >= 5) {
        console.log(`  ✅ PASS: Period Filter [THIS_YEAR] returned all ${filterYear.body.length} transactions for this year.`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Period Filter [THIS_YEAR] returned ${filterYear.body ? filterYear.body.length : 0} records.`);
        failed++;
    }

    console.log('\n====================================================================');
    console.log(`📊 FINAL TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================================\n');
}

runFullSystemWorkflowTest().catch(console.error);
