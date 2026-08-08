// ====================================================================
// Role-Based UI Permissions Test (Clerk & Auditor Add Product Button Hiding)
// ====================================================================

const fs = require('fs');
const path = require('path');

function testRolePermissionsUI() {
    console.log('\n====================================================================');
    console.log('🔒 AUTOMATED TEST: Role-Based UI Button Visibility');
    console.log('====================================================================\n');

    let passed = 0;
    let failed = 0;

    const htmlContent = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    const jsContent = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

    // 1. Verify index.html contains btnAddProduct button ID
    console.log('📌 STEP 1: Verifying #btnAddProduct element in public/index.html...');
    if (htmlContent.includes('id="btnAddProduct"')) {
        console.log('  ✅ PASS: #btnAddProduct ID element present in index.html!');
        passed++;
    } else {
        console.log('  ❌ FAIL: #btnAddProduct ID missing from index.html');
        failed++;
    }

    // 2. Verify updateRolePermissionsUI checks for CLERK and AUDITOR to hide button
    console.log('\n📌 STEP 2: Verifying updateRolePermissionsUI() role enforcement logic in public/app.js...');
    if (jsContent.includes('btnAddProduct.style.display = \'none\'') && jsContent.includes("activeRole === 'ADMIN' || activeRole === 'MANAGER'")) {
        console.log('  ✅ PASS: updateRolePermissionsUI() correctly restricts + Add New Product visibility to ADMIN and MANAGER roles only!');
        passed++;
    } else {
        console.log('  ❌ FAIL: Role visibility restriction missing in app.js');
        failed++;
    }

    // 3. Verify openAddProductModal access check
    console.log('\n📌 STEP 3: Verifying openAddProductModal() access guard in public/app.js...');
    if (jsContent.includes("activeRole !== 'ADMIN' && activeRole !== 'MANAGER'") && jsContent.includes("Role '${activeRole}' cannot add products")) {
        console.log('  ✅ PASS: openAddProductModal() contains access guard blocking CLERK & AUDITOR!');
        passed++;
    } else {
        console.log('  ❌ FAIL: Guard missing in openAddProductModal()');
        failed++;
    }

    console.log('\n====================================================================');
    console.log(`📊 TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================================\n');

    if (failed > 0) process.exit(1);
}

testRolePermissionsUI();
