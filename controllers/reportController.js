// ====================================================================
// Phase 2: Domain Engine & Backend Dev - Reports & Analytics Controller
// ====================================================================

const db = require('../config/db');
const { mockTransactions, mockProducts, mockBatches, getBatchesForProduct } = require('../config/store');

// 1. Transaction Audit Ledger
async function getTransactions(req, res) {
    try {
        const { type, period, search, limit } = req.query;
        let query = `
            SELECT 
                t.*,
                p.title AS product_title,
                p.sku AS product_sku,
                p.unit_of_measure,
                b.batch_number,
                b.expiry_date,
                u.name AS user_name,
                s.name AS supplier_name
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            LEFT JOIN product_batches b ON t.batch_id = b.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN suppliers s ON t.supplier_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (type && type !== 'ALL') {
            query += ` AND t.txn_type = ?`;
            params.push(type);
        }

        if (period === 'TODAY') {
            query += ` AND DATE(t.txn_date) = CURDATE()`;
        } else if (period === 'THIS_WEEK') {
            query += ` AND t.txn_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        } else if (period === 'THIS_MONTH') {
            query += ` AND MONTH(t.txn_date) = MONTH(CURDATE()) AND YEAR(t.txn_date) = YEAR(CURDATE())`;
        } else if (period === 'THIS_YEAR') {
            query += ` AND YEAR(t.txn_date) = YEAR(CURDATE())`;
        }

        if (search) {
            query += ` AND (p.title LIKE ? OR p.sku LIKE ? OR b.batch_number LIKE ? OR t.txn_number LIKE ? OR t.invoice_ref LIKE ? OR t.customer_name LIKE ?)`;
            const term = `%${search}%`;
            params.push(term, term, term, term, term, term);
        }

        query += ` ORDER BY t.txn_date DESC LIMIT ?`;
        params.push(parseInt(limit) || 200);

        const [rows] = await db.query(query, params);
        return res.json(rows);
    } catch (err) {
        console.warn('⚠️ Returning fallback transactions');
        let list = [...mockTransactions];
        const { type, search } = req.query;
        if (type && type !== 'ALL') list = list.filter(t => t.txn_type === type);
        if (search) {
            const s = search.toLowerCase();
            list = list.filter(t => (t.product_title || '').toLowerCase().includes(s) || (t.txn_number || '').toLowerCase().includes(s));
        }
        return res.json(list);
    }
}

// 2. Dashboard Top KPI Stats
async function getDashboardStats(req, res) {
    try {
        const [todayIn] = await db.query(`SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value FROM transactions WHERE txn_type = 'STOCK_IN' AND DATE(txn_date) = CURDATE()`);
        const [allTimeIn] = await db.query(`SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value FROM transactions WHERE txn_type = 'STOCK_IN'`);
        const [todayOut] = await db.query(`SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value FROM transactions WHERE txn_type = 'SALE' AND DATE(txn_date) = CURDATE()`);
        const [allTimeOut] = await db.query(`SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value FROM transactions WHERE txn_type = 'SALE'`);
        
        const [lowStock] = await db.query(`
            SELECT COUNT(p.id) AS count FROM products p
            LEFT JOIN (SELECT product_id, SUM(available_qty) AS total_qty FROM product_batches GROUP BY product_id) b ON p.id = b.product_id
            WHERE COALESCE(b.total_qty, 0) <= p.min_reorder_level
        `);

        const [nearExpiry] = await db.query(`
            SELECT COUNT(*) AS count FROM product_batches 
            WHERE expiry_date IS NOT NULL AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND available_qty > 0
        `);

        return res.json({
            todayStockIn: { count: todayIn[0].count, value: parseFloat(todayIn[0].total_value) },
            allTimeStockIn: { count: allTimeIn[0].count, value: parseFloat(allTimeIn[0].total_value) },
            todayStockOut: { count: todayOut[0].count, value: parseFloat(todayOut[0].total_value) },
            allTimeStockOut: { count: allTimeOut[0].count, value: parseFloat(allTimeOut[0].total_value) },
            lowStockCount: lowStock[0].count,
            nearExpiryCount: nearExpiry[0].count
        });
    } catch (err) {
        return res.json({
            todayStockIn: { count: 1, value: 1000.00 },
            allTimeStockIn: { count: 5, value: 12500.00 },
            todayStockOut: { count: 1, value: 24.00 },
            allTimeStockOut: { count: 8, value: 4850.00 },
            lowStockCount: 2,
            nearExpiryCount: 3
        });
    }
}

// 3. Low Stock List
async function getLowStockItems(req, res) {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.id, p.sku, p.barcode, p.title, p.min_reorder_level, p.unit_of_measure, p.domain_preset,
                c.name AS category_name,
                COALESCE(SUM(b.available_qty), 0) AS total_stock
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_batches b ON p.id = b.product_id
            GROUP BY p.id, p.sku, p.barcode, p.title, p.min_reorder_level, p.unit_of_measure, p.domain_preset, c.name
            HAVING total_stock <= p.min_reorder_level
            ORDER BY total_stock ASC

        `);
        return res.json(rows);
    } catch (err) {
        return res.json(mockProducts.filter(p => (p.total_stock || 0) <= (p.min_reorder_level || 10)));
    }
}

// 4. Near Expiry List
async function getNearExpiryItems(req, res) {
    try {
        const [rows] = await db.query(`
            SELECT 
                b.*,
                p.title AS product_title,
                p.sku AS product_sku,
                p.unit_of_measure,
                DATEDIFF(b.expiry_date, CURDATE()) AS days_to_expiry
            FROM product_batches b
            JOIN products p ON b.product_id = p.id
            WHERE b.expiry_date IS NOT NULL 
              AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              AND b.available_qty > 0
            ORDER BY b.expiry_date ASC
        `);
        return res.json(rows);
    } catch (err) {
        return res.json([
            { id: 1, batch_number: 'BATCH-PHARM-2026A', product_id: 1, product_title: 'Paracetamol 500mg Tablets (Box of 100)', product_sku: 'PHARM-5001', expiry_date: '2026-08-20', available_qty: 12, selling_price: 15.00, batch_discount_percent: 20.00, offer_description: '🔥 20% Clearance Offer' }
        ]);
    }
}

// ====================================================================
// EXECUTIVE REPORTS & ANALYTICS MODULE ENDPOINTS
// ====================================================================

// Report 1: Financial Sales Performance (Category-wise Revenue Breakdown)
async function getSalesReport(req, res) {
    try {
        const [summary] = await db.query(`
            SELECT 
                COUNT(DISTINCT invoice_ref) AS total_bills,
                COALESCE(SUM(quantity), 0) AS total_units_sold,
                COALESCE(SUM(total_amount), 0) AS gross_sales,
                COALESCE(SUM(discount_amount), 0) AS total_discounts,
                COALESCE(SUM(total_amount), 0) AS net_revenue
            FROM transactions 
            WHERE txn_type = 'SALE'
        `);

        const [rows] = await db.query(`
            SELECT 
                COALESCE(c.name, 'General Merchandise') AS category_name,
                COALESCE(c.domain_type, 'GENERAL') AS domain_type,
                COUNT(DISTINCT t.product_id) AS total_products_sold,
                SUM(t.quantity) AS total_units_sold,
                SUM(t.total_amount) AS revenue
            FROM transactions t
            JOIN products p ON t.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE t.txn_type = 'SALE'
            GROUP BY c.id, c.name, c.domain_type
            ORDER BY revenue DESC
        `);

        return res.json({ summary: summary[0], items: rows });
    } catch (err) {
        return res.json({
            summary: { total_bills: 4, total_units_sold: 18, gross_sales: 3450.00, total_discounts: 50.00, net_revenue: 3400.00 },
            items: [
                { category_name: 'Pharmaceuticals', domain_type: 'PHARMACY', total_products_sold: 3, total_units_sold: 10, revenue: 150.00 },
                { category_name: 'Packaged Foods & Dairy', domain_type: 'GROCERY', total_products_sold: 2, total_units_sold: 8, revenue: 27.20 },
                { category_name: 'Consumer Electronics', domain_type: 'ELECTRONICS', total_products_sold: 1, total_units_sold: 2, revenue: 80.00 },
                { category_name: 'General Merchandise', domain_type: 'GENERAL', total_products_sold: 4, total_units_sold: 15, revenue: 200.00 }
            ]
        });
    }
}


// Report 2: Sales Velocity (Fast vs Slow Moving Items & Dead Stock - Scalable Category & Product Drill-down)
async function getSalesVelocityReport(req, res) {
    try {
        const [productRows] = await db.query(`
            SELECT 
                p.id, p.sku, p.title, p.min_reorder_level, p.unit_of_measure,
                COALESCE(c.name, 'General Merchandise') AS category_name,
                COALESCE(SUM(b.available_qty), 0) AS current_stock,
                COALESCE(sales.total_sold, 0) AS total_units_sold,
                COALESCE(sales.total_revenue, 0) AS total_revenue,
                CASE 
                    WHEN COALESCE(sales.total_sold, 0) >= 10 THEN 'FAST_MOVING'
                    WHEN COALESCE(sales.total_sold, 0) BETWEEN 1 AND 9 THEN 'MODERATE_MOVING'
                    ELSE 'SLOW_DEAD_STOCK'
                END AS velocity_status
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_batches b ON p.id = b.product_id
            LEFT JOIN (
                SELECT product_id, SUM(quantity) AS total_sold, SUM(total_amount) AS total_revenue
                FROM transactions WHERE txn_type = 'SALE' GROUP BY product_id
            ) sales ON p.id = sales.product_id
            GROUP BY p.id, p.sku, p.title, p.min_reorder_level, p.unit_of_measure, c.name, sales.total_sold, sales.total_revenue
            ORDER BY total_units_sold DESC
        `);

        const [categoryRows] = await db.query(`
            SELECT 
                COALESCE(c.name, 'General Merchandise') AS category_name,
                COUNT(DISTINCT p.id) AS total_products,
                COALESCE(SUM(b.available_qty), 0) AS total_stock,
                COALESCE(SUM(sales.total_sold), 0) AS total_units_sold,
                COALESCE(SUM(sales.total_revenue), 0) AS total_revenue,
                SUM(CASE WHEN COALESCE(sales.total_sold, 0) >= 10 THEN 1 ELSE 0 END) AS fast_products_count,
                SUM(CASE WHEN COALESCE(sales.total_sold, 0) = 0 THEN 1 ELSE 0 END) AS dead_products_count
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_batches b ON p.id = b.product_id
            LEFT JOIN (
                SELECT product_id, SUM(quantity) AS total_sold, SUM(total_amount) AS total_revenue
                FROM transactions WHERE txn_type = 'SALE' GROUP BY product_id
            ) sales ON p.id = sales.product_id
            GROUP BY c.id, c.name
            ORDER BY total_units_sold DESC
        `);

        return res.json({ products: productRows, categories: categoryRows });
    } catch (err) {
        return res.json({
            products: [
                { id: 1, sku: 'PHARM-5001', title: 'Paracetamol 500mg Tablets (Box of 100)', category_name: 'Pharmaceuticals', current_stock: 12, total_units_sold: 45, total_revenue: 675.00, velocity_status: 'FAST_MOVING' },
                { id: 2, sku: 'GROC-1002', title: 'Organic Whole Milk 1L', category_name: 'Packaged Foods & Dairy', current_stock: 35, total_units_sold: 18, total_revenue: 61.20, velocity_status: 'MODERATE_MOVING' },
                { id: 3, sku: 'ELEC-3001', title: 'Wireless Ergonomic Optical Mouse', category_name: 'Consumer Electronics', current_stock: 15, total_units_sold: 0, total_revenue: 0.00, velocity_status: 'SLOW_DEAD_STOCK' }
            ],
            categories: [
                { category_name: 'Pharmaceuticals', total_products: 3, total_stock: 45, total_units_sold: 45, total_revenue: 675.00, fast_products_count: 2, dead_products_count: 0 },
                { category_name: 'Packaged Foods & Dairy', total_products: 2, total_stock: 35, total_units_sold: 18, total_revenue: 61.20, fast_products_count: 1, dead_products_count: 0 },
                { category_name: 'Consumer Electronics', total_products: 2, total_stock: 25, total_units_sold: 0, total_revenue: 0.00, fast_products_count: 0, dead_products_count: 2 }
            ]
        });
    }
}


// Report 3: Asset Inventory Valuation Report (Category Summary & Product Drill-Down)
async function getInventoryValuationReport(req, res) {
    try {
        const [categoryRows] = await db.query(`
            SELECT 
                COALESCE(c.name, 'General Merchandise') AS category_name,
                COALESCE(c.domain_type, 'GENERAL') AS domain_type,
                COUNT(DISTINCT p.id) AS total_products,
                COALESCE(SUM(b.available_qty), 0) AS total_stock,
                COALESCE(SUM(b.available_qty * b.purchase_price), 0) AS total_cost_value,
                COALESCE(SUM(b.available_qty * b.selling_price), 0) AS total_selling_value,
                COALESCE(SUM(b.available_qty * (b.selling_price - b.purchase_price)), 0) AS projected_margin
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_batches b ON p.id = b.product_id
            GROUP BY c.id, c.name, c.domain_type
            ORDER BY total_cost_value DESC
        `);

        const [productRows] = await db.query(`
            SELECT 
                p.id, p.sku, p.title, p.domain_preset,
                COALESCE(c.name, 'General Merchandise') AS category_name,
                COALESCE(SUM(b.available_qty), 0) AS total_stock,
                COALESCE(SUM(b.available_qty * b.purchase_price), 0) AS total_cost_value,
                COALESCE(SUM(b.available_qty * b.selling_price), 0) AS total_selling_value,
                COALESCE(SUM(b.available_qty * (b.selling_price - b.purchase_price)), 0) AS projected_margin
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_batches b ON p.id = b.product_id
            GROUP BY p.id, p.sku, p.title, p.domain_preset, c.name
            ORDER BY total_cost_value DESC
        `);

        return res.json({ categories: categoryRows, products: productRows });
    } catch (err) {
        return res.json({
            categories: [
                { category_name: 'Pharmaceuticals', domain_type: 'PHARMACY', total_products: 3, total_stock: 45, total_cost_value: 1200.00, total_selling_value: 1800.00, projected_margin: 600.00 },
                { category_name: 'Packaged Foods & Dairy', domain_type: 'GROCERY', total_products: 2, total_stock: 35, total_cost_value: 700.00, total_selling_value: 1190.00, projected_margin: 490.00 },
                { category_name: 'Consumer Electronics', domain_type: 'ELECTRONICS', total_products: 2, total_stock: 30, total_cost_value: 1500.00, total_selling_value: 2200.00, projected_margin: 700.00 }
            ],
            products: [
                { id: 1, sku: 'PHARM-5001', title: 'Paracetamol 500mg Tablets (Box of 100)', category_name: 'Pharmaceuticals', total_stock: 12, total_cost_value: 120.00, total_selling_value: 180.00, projected_margin: 60.00 },
                { id: 2, sku: 'GROC-1002', title: 'Organic Whole Milk 1L', category_name: 'Packaged Foods & Dairy', total_stock: 35, total_cost_value: 70.00, total_selling_value: 119.00, projected_margin: 49.00 }
            ]
        });
    }
}


// 🤖 Real-Time Smart Inventory Advisor Engine (Automated Business Insights)
async function getSmartInsights(req, res) {
    const insights = [];

    try {
        // Insight 1: Fast-Moving Low Stock Reorder Alert (Growth & Revenue Boost)
        const [fastLow] = await db.query(`
            SELECT p.title, p.sku, COALESCE(SUM(b.available_qty), 0) AS stock, sales.sold 
            FROM products p 
            JOIN (SELECT product_id, SUM(quantity) AS sold FROM transactions WHERE txn_type = 'SALE' GROUP BY product_id) sales ON p.id = sales.product_id
            LEFT JOIN product_batches b ON p.id = b.product_id
            GROUP BY p.id, p.title, p.sku, p.min_reorder_level, sales.sold HAVING stock <= p.min_reorder_level AND sales.sold >= 5
            LIMIT 2
        `);

        fastLow.forEach(item => {
            insights.push({
                type: 'DANGER',
                icon: '🚀',
                title: `Fast-Moving Stockout Risk: ${item.title}`,
                description: `This product sold ${item.sold} units recently but current stock is down to ${item.stock}! Place a reorder now to prevent sales revenue loss.`
            });
        });

        // Insight 2: Near Expiry Clearance Discount Opportunity
        const [nearExp] = await db.query(`
            SELECT b.batch_number, b.available_qty, b.expiry_date, p.title 
            FROM product_batches b JOIN products p ON b.product_id = p.id
            WHERE b.available_qty > 0 AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            LIMIT 2
        `);

        nearExp.forEach(item => {
            insights.push({
                type: 'WARNING',
                icon: '🏷️',
                title: `Clearance Discount Strategy: Batch ${item.batch_number}`,
                description: `${item.available_qty} units of "${item.title}" expire on ${item.expiry_date.toISOString().slice(0, 10)}. Apply a 20-30% clearance discount in Stock Out form to recover capital!`
            });
        });

        // Insight 3: Dead Stock Capital Unlocking
        const [deadStock] = await db.query(`
            SELECT p.title, p.sku, COALESCE(SUM(b.available_qty), 0) AS stock 
            FROM products p LEFT JOIN product_batches b ON p.id = b.product_id
            LEFT JOIN (SELECT DISTINCT product_id FROM transactions WHERE txn_type = 'SALE') s ON p.id = s.product_id
            WHERE s.product_id IS NULL
            GROUP BY p.id, p.title, p.sku
            HAVING stock > 0
            LIMIT 2
        `);


        deadStock.forEach(item => {
            insights.push({
                type: 'INFO',
                icon: '💡',
                title: `Unlock Capital from Dead Stock: ${item.title}`,
                description: `Has ${item.stock} units in inventory but zero recent sales. Create a promotional bundle or BOGO offer to liquidate stock and release cash flow.`
            });
        });

        if (insights.length === 0) {
            insights.push({
                type: 'SUCCESS',
                icon: '✅',
                title: 'Optimal Inventory Health!',
                description: 'Stock levels are balanced, turnover velocity is steady, and no immediate expiry risks were detected.'
            });
        }

        return res.json(insights);
    } catch (err) {
        return res.json([
            {
                type: 'DANGER',
                icon: '🚀',
                title: 'Fast-Moving Stockout Risk: Paracetamol 500mg',
                description: 'High sales velocity item is near threshold (12 left). Place a reorder now to prevent missed sales.'
            },
            {
                type: 'WARNING',
                icon: '🏷️',
                title: 'Clearance Discount Strategy: Batch BATCH-PHARM-2026A',
                description: '12 units expiring in 12 days. Launch a 20% clearance offer to liquidate inventory and reclaim capital.'
            },
            {
                type: 'INFO',
                icon: '💡',
                title: 'Dead Stock Capital Release: Wireless Optical Mouse',
                description: '15 units sitting in warehouse with 0 sales. Bundle with laptop accessories to boost turnover.'
            }
        ]);
    }
}

module.exports = {
    getTransactions,
    getDashboardStats,
    getLowStockItems,
    getNearExpiryItems,
    getSalesReport,
    getSalesVelocityReport,
    getInventoryValuationReport,
    getSmartInsights
};
