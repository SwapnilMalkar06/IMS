const http = require('http');

function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(JSON.stringify(postData));
        req.end();
    });
}

async function runSupplierTest() {
    console.log('====================================================================');
    console.log('🏢 AUTOMATED TEST: Supplier Registration & Management API');
    console.log('====================================================================\n');

    try {
        // Step 1: Create a new supplier
        console.log('📌 STEP 1: Creating new supplier via POST /api/suppliers...');
        const newSupplierPayload = {
            name: `Test Vendor ${Date.now()}`,
            contact_person: 'Jane Doe',
            phone: '+91 9876543210',
            email: 'vendor@testsupply.com',
            address: 'Plot 45, Logistics Park, Mumbai'
        };

        const postRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/suppliers',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'ADMIN'
            }
        }, newSupplierPayload);

        if (postRes.status === 201 && postRes.data.supplier) {
            console.log(`  ✅ PASS: Created supplier "${postRes.data.supplier.name}" with ID #${postRes.data.supplier.id}!`);
        } else {
            console.error('  ❌ FAIL: Supplier creation failed', postRes);
            process.exit(1);
        }

        // Step 2: Query GET /api/suppliers
        console.log('\n📌 STEP 2: Querying all suppliers via GET /api/suppliers...');
        const getRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/suppliers',
            method: 'GET',
            headers: { 'X-User-Role': 'ADMIN' }
        });

        if (getRes.status === 200 && Array.isArray(getRes.data)) {
            console.log(`  ✅ PASS: Successfully retrieved ${getRes.data.length} registered supplier(s) from MySQL database!`);
        } else {
            console.error('  ❌ FAIL: Could not fetch suppliers', getRes);
            process.exit(1);
        }

        console.log('\n====================================================================');
        console.log('📊 TEST RESULT: 2 PASSED, 0 FAILED');
        console.log('====================================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed with error:', err);
        process.exit(1);
    }
}

runSupplierTest();
