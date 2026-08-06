// ====================================================================
// Phase 2: Backend Dev - Centralized API Router
// ====================================================================

const express = require('express');
const router = express.Router();

const { requirePermission } = require('../middleware/roleGuard');
const { getProducts, createProduct } = require('../controllers/productController');
const { getProductBatches } = require('../controllers/batchController');
const { processStockIn } = require('../controllers/stockInController');
const { processStockOut } = require('../controllers/stockOutController');
const { getTransactions, getDashboardStats } = require('../controllers/reportController');
const db = require('../config/db');

// Health Check
router.get('/health', (req, res) => res.json({ status: 'online', version: '1.0.0' }));

// Dashboard Stats (Read Permission)
router.get('/dashboard/stats', requirePermission('READ'), getDashboardStats);

// Products Catalog Routes
router.get('/products', requirePermission('READ'), getProducts);
router.post('/products', requirePermission('MANAGE_PRODUCTS'), createProduct);

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
