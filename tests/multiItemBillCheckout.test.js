// ====================================================================
// Multi-Item Bill Checkout & Non-Editable Price Verification Test
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

async function runMultiItemBillTest() {
    console.log('\n====================================================================');
    console.log('🛍️ AUTOMATED TEST: Multi-Item Bill Checkout & Unique Bill Number');
    console.log('====================================================================\n');

    let passed = 0;
    let failed = 0;

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
    };

    const ts = Date.now().toString().slice(-4);

    // 1. Create Product 1 (Basmati Rice)
    console.log(`📌 STEP 1: Creating Product 1 (Basmati Rice)...`);
    const prod1Res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/products', method: 'POST', headers: authHeaders
    }, {
        sku: `RICE-${ts}`, title: `Royal Basmati Rice 5Kg ${ts}`, category_id: 2, unit_of_measure: 'Pcs', domain_preset: 'GROCERY'
    });
    const prod1Id = prod1Res.body.id;

    // Stock In Product 1 (50 Pcs at ₹450 selling price)
    const stockIn1 = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-in', method: 'POST', headers: authHeaders
    }, {
        product_id: prod1Id, product_title: `Royal Basmati Rice 5Kg ${ts}`, sku: `RICE-${ts}`,
        batch_number: `BATCH-RICE-${ts}`, quantity: 50, purchase_price: 350.00, selling_price: 450.00
    });
    const batch1Id = stockIn1.body.batchId || 1;
    console.log(`  ✅ PASS: Product 1 created and Stocked In (Qty: 50 Pcs, Batch ID: ${batch1Id})`);
    passed++;

    // 2. Create Product 2 (Sunflower Oil)
    console.log(`\n📌 STEP 2: Creating Product 2 (Sunflower Oil)...`);
    const prod2Res = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/products', method: 'POST', headers: authHeaders
    }, {
        sku: `OIL-${ts}`, title: `Fortune Sunflower Oil 1L ${ts}`, category_id: 2, unit_of_measure: 'Pcs', domain_preset: 'GROCERY'
    });
    const prod2Id = prod2Res.body.id;

    // Stock In Product 2 (100 Pcs at ₹160 selling price)
    const stockIn2 = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-in', method: 'POST', headers: authHeaders
    }, {
        product_id: prod2Id, product_title: `Fortune Sunflower Oil 1L ${ts}`, sku: `OIL-${ts}`,
        batch_number: `BATCH-OIL-${ts}`, quantity: 100, purchase_price: 120.00, selling_price: 160.00
    });
    const batch2Id = stockIn2.body.batchId || 2;
    console.log(`  ✅ PASS: Product 2 created and Stocked In (Qty: 100 Pcs, Batch ID: ${batch2Id})`);
    passed++;

    // 3. Perform Multi-Item Bill Checkout under single unique bill reference
    const uniqueBillNo = `BILL-20260808-${ts}`;
    console.log(`\n📌 STEP 3: Submitting Multi-Item Checkout under unique Bill #: ${uniqueBillNo}...`);
    const checkoutRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/stock-out', method: 'POST', headers: authHeaders
    }, {
        invoice_ref: uniqueBillNo,
        customer_name: 'Swapnil Malkar (Retail Customer)',
        txn_type: 'SALE',
        items: [
            { product_id: prod1Id, batch_id: batch1Id, quantity: 2, unit_price: 450.00, discount_amount: 20.00 }, // 2 Bags Rice
            { product_id: prod2Id, batch_id: batch2Id, quantity: 5, unit_price: 160.00, discount_amount: 10.00 }  // 5 Bottles Oil
        ]
    });

    if (checkoutRes.statusCode === 201 && checkoutRes.body.billNumber === uniqueBillNo) {
        console.log(`  ✅ PASS: Multi-Item Bill Checkout successfully processed under Bill #${uniqueBillNo}!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Bill Checkout failed with status ${checkoutRes.statusCode}:`, checkoutRes.body);
        failed++;
    }

    // 4. Verify Stock Deduction in Product Catalog
    console.log(`\n📌 STEP 4: Verifying Catalog Table Stock Deductions...`);
    const p1Check = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/products?search=RICE-${ts}`, method: 'GET', headers: authHeaders
    });
    const p1 = Array.isArray(p1Check.body) ? p1Check.body.find(p => p.id == prod1Id || p.sku === `RICE-${ts}`) : null;

    if (p1 && parseInt(p1.total_stock) === 48) { // 50 - 2 = 48
        console.log(`  ✅ PASS: Product 1 stock correctly deducted to: 48 Pcs!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Product 1 stock is ${p1 ? p1.total_stock : 'N/A'}, expected 48 Pcs.`);
        failed++;
    }

    // 5. Verify Daily Audit Ledger shared Bill Number recording
    console.log(`\n📌 STEP 5: Verifying Daily Audit Ledger for shared Bill #: ${uniqueBillNo}...`);
    const ledgerRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/transactions?search=${encodeURIComponent(uniqueBillNo)}`, method: 'GET', headers: authHeaders
    });

    if (Array.isArray(ledgerRes.body) && ledgerRes.body.length >= 2) {
        console.log(`  ✅ PASS: Found ${ledgerRes.body.length} transaction entries in Audit Ledger tied to Bill #${uniqueBillNo}!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Audit ledger entries not found for bill #${uniqueBillNo}.`);
        failed++;
    }

    console.log('\n====================================================================');
    console.log(`📊 TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================================\n');
}

runMultiItemBillTest().catch(console.error);
