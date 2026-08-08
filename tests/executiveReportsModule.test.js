// ====================================================================
// Executive Reports & Analytics Module Integration Test
// ====================================================================

const http = require('http');

function makeRequest(options) {
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
        req.end();
    });
}

async function runExecutiveReportsTest() {
    console.log('\n====================================================================');
    console.log('📊 AUTOMATED TEST: Executive Reports, Analytics & Smart Insights');
    console.log('====================================================================\n');

    let passed = 0;
    let failed = 0;

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
    };

    // 1. Query Financial Sales Report Endpoint
    console.log(`📌 STEP 1: Querying Financial Sales Report (/api/reports/financial-sales)...`);
    const salesRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/reports/financial-sales', method: 'GET', headers: authHeaders
    });

    if (salesRes.statusCode === 200 && salesRes.body.summary && Array.isArray(salesRes.body.items)) {
        console.log(`  ✅ PASS: Financial Sales Report returned total gross revenue ₹${salesRes.body.summary.gross_sales || 0}!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Financial Sales Report returned status ${salesRes.statusCode}`, salesRes.body);
        failed++;
    }

    // 2. Query Sales Velocity Report Endpoint (Fast vs Slow Moving)
    console.log(`\n📌 STEP 2: Querying Sales Velocity Report (/api/reports/sales-velocity)...`);
    const velocityRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/reports/sales-velocity', method: 'GET', headers: authHeaders
    });

    if (velocityRes.statusCode === 200 && velocityRes.body && Array.isArray(velocityRes.body.products) && Array.isArray(velocityRes.body.categories)) {
        console.log(`  ✅ PASS: Sales Velocity Report returned ${velocityRes.body.categories.length} category summary item(s) & ${velocityRes.body.products.length} product drill-down item(s)!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Sales Velocity Report returned status ${velocityRes.statusCode}`, velocityRes.body);
        failed++;
    }


    // 3. Query Inventory Asset Valuation Endpoint
    console.log(`\n📌 STEP 3: Querying Inventory Asset Valuation Report (/api/reports/inventory-valuation)...`);
    const valRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/reports/inventory-valuation', method: 'GET', headers: authHeaders
    });

    if (valRes.statusCode === 200 && Array.isArray(valRes.body)) {
        console.log(`  ✅ PASS: Inventory Asset Valuation Report returned ${valRes.body.length} catalog asset item(s)!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Inventory Asset Valuation Report returned status ${valRes.statusCode}`, valRes.body);
        failed++;
    }

    // 4. Query Real-Time Smart Insights Engine Endpoint
    console.log(`\n📌 STEP 4: Querying Smart Insights Recommendation Engine (/api/reports/smart-insights)...`);
    const insightsRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/reports/smart-insights', method: 'GET', headers: authHeaders
    });

    if (insightsRes.statusCode === 200 && Array.isArray(insightsRes.body) && insightsRes.body.length > 0) {
        console.log(`  ✅ PASS: Smart Insights Engine returned ${insightsRes.body.length} actionable business recommendation(s)!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Smart Insights Engine returned status ${insightsRes.statusCode}`, insightsRes.body);
        failed++;
    }

    console.log('\n====================================================================');
    console.log(`📊 TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================================\n');
}

runExecutiveReportsTest().catch(console.error);
