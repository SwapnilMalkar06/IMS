// ====================================================================
// Phase 2: Backend Dev - Centralized API Router
// ====================================================================

const express = require('express');
const router = express.Router();

const { requirePermission } = require('../middleware/roleGuard');
const { getProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { getProductBatches } = require('../controllers/batchController');
const { processStockIn } = require('../controllers/stockInController');
const { processStockOut } = require('../controllers/stockOutController');
const { getTransactions, getDashboardStats, getLowStockItems, getNearExpiryItems } = require('../controllers/reportController');
const db = require('../config/db');

// Health Check
router.get('/health', (req, res) => res.json({ status: 'online', version: '1.0.0' }));


// Auth Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (password !== 'admin123') {
        return res.status(401).json({ error: 'Invalid password. Default password is admin123' });
    }

    const demoUsers = {
        'admin@inventory.com': { id: 1, name: 'Super Admin', email: 'admin@inventory.com', role: 'ADMIN' },
        'manager@inventory.com': { id: 2, name: 'Store Manager', email: 'manager@inventory.com', role: 'MANAGER' },
        'clerk@inventory.com': { id: 3, name: 'Inventory Clerk', email: 'clerk@inventory.com', role: 'CLERK' },
        'auditor@inventory.com': { id: 4, name: 'Auditor Viewer', email: 'auditor@inventory.com', role: 'AUDITOR' }
    };

    const user = demoUsers[email.toLowerCase()] || {
        id: Date.now(),
        name: email.split('@')[0],
        email: email,
        role: 'CLERK'
    };

    return res.json({
        message: 'Login successful!',
        user,
        token: `token-${Date.now()}`
    });
});


// Dashboard Stats (Read Permission)
router.get('/dashboard/stats', requirePermission('READ'), getDashboardStats);
router.get('/reports/low-stock', requirePermission('READ'), getLowStockItems);
router.get('/reports/near-expiry', requirePermission('READ'), getNearExpiryItems);


// Products Catalog Routes (Create, Read, Update, Delete)
router.get('/products', requirePermission('READ'), getProducts);
router.post('/products', requirePermission('MANAGE_PRODUCTS'), createProduct);
router.put('/products/:id', requirePermission('MANAGE_PRODUCTS'), updateProduct);
router.delete('/products/:id', requirePermission('MANAGE_PRODUCTS'), deleteProduct);


// Batch FEFO Query Routes
router.get('/batches/:productId', requirePermission('READ'), getProductBatches);

// Stock In Receiving Entry
router.post('/stock-in', requirePermission('STOCK_IN'), processStockIn);

// Stock Out Dispatch & Sales Entry
router.post('/stock-out', requirePermission('STOCK_OUT'), processStockOut);

// Transaction Audit Ledger
router.get('/transactions', requirePermission('READ'), getTransactions);

// Categories & Suppliers
router.get('/categories', requirePermission('READ'), async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM categories ORDER BY name ASC`);
        res.json(rows);
    } catch (err) {
        console.warn('⚠️ Returning fallback categories');
        res.json([
            { id: 1, name: 'Pharmaceuticals', domain_type: 'PHARMACY' },
            { id: 2, name: 'Packaged Foods & Dairy', domain_type: 'GROCERY' },
            { id: 3, name: 'Consumer Electronics', domain_type: 'ELECTRONICS' },
            { id: 4, name: 'General Merchandise', domain_type: 'GENERAL' }
        ]);
    }
});

router.get('/suppliers', requirePermission('READ'), async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM suppliers ORDER BY name ASC`);
        res.json(rows);
    } catch (err) {
        console.warn('⚠️ Returning fallback suppliers');
        res.json([
            { id: 1, name: 'PharmaSupply Co.' },
            { id: 2, name: 'Global Electronics Ltd.' },
            { id: 3, name: 'Metro Wholesalers' }
        ]);
    }
});

module.exports = router;
