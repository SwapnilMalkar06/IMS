// ====================================================================
// Dashboard Alert Breakdown Modals Integration Test
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

async function runDashboardAlertTest() {
    console.log('\n====================================================================');
    console.log('⚠️ AUTOMATED TEST: Dashboard Low Stock & Near Expiry Alert Modals');
    console.log('====================================================================\n');

    let passed = 0;
    let failed = 0;

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
    };

    // 1. Query Low Stock Breakdown API Endpoint
    console.log(`📌 STEP 1: Querying Low Stock Breakdown Endpoint (/api/reports/low-stock)...`);
    const lowStockRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/reports/low-stock', method: 'GET', headers: authHeaders
    });

    if (lowStockRes.statusCode === 200 && Array.isArray(lowStockRes.body)) {
        console.log(`  ✅ PASS: Low Stock Endpoint returned ${lowStockRes.body.length} item(s) requiring reorder!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Low Stock Endpoint returned status ${lowStockRes.statusCode}`, lowStockRes.body);
        failed++;
    }

    // 2. Query Near Expiry Breakdown API Endpoint
    console.log(`\n📌 STEP 2: Querying Near Expiry Breakdown Endpoint (/api/reports/near-expiry)...`);
    const nearExpiryRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/reports/near-expiry', method: 'GET', headers: authHeaders
    });

    if (nearExpiryRes.statusCode === 200 && Array.isArray(nearExpiryRes.body)) {
        console.log(`  ✅ PASS: Near Expiry Endpoint returned ${nearExpiryRes.body.length} batch(es) expiring within 30 days!`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: Near Expiry Endpoint returned status ${nearExpiryRes.statusCode}`, nearExpiryRes.body);
        failed++;
    }

    console.log('\n====================================================================');
    console.log(`📊 TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================================\n');
}

runDashboardAlertTest().catch(console.error);
