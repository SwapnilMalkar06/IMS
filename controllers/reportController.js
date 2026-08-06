// ====================================================================
// Phase 2: Domain Engine & Backend Dev - Reports & Ledger Controller
// ====================================================================

const db = require('../config/db');
const { mockTransactions } = require('../config/store');

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
        } else if (period === 'THIS_MONTH') {
            query += ` AND MONTH(t.txn_date) = MONTH(CURDATE()) AND YEAR(t.txn_date) = YEAR(CURDATE())`;
        } else if (period === 'THIS_YEAR') {
            query += ` AND YEAR(t.txn_date) = YEAR(CURDATE())`;
        }

        if (search) {
            query += ` AND (p.title LIKE ? OR p.sku LIKE ? OR b.batch_number LIKE ? OR t.txn_number LIKE ? OR t.customer_name LIKE ?)`;
            const term = `%${search}%`;
            params.push(term, term, term, term, term);
        }

        query += ` ORDER BY t.txn_date DESC LIMIT ?`;
        params.push(parseInt(limit) || 200);

        const [rows] = await db.query(query, params);
        return res.json(rows);
    } catch (err) {
        console.warn('⚠️ MySQL unaccessible, returning mock transactions with filters');
        const { type, period, search } = req.query;
        let list = [...mockTransactions];

        if (type && type !== 'ALL') {
            list = list.filter(t => t.txn_type === type);
        }

        const now = new Date();
        if (period === 'TODAY') {
            const todayStr = now.toISOString().slice(0, 10);
            list = list.filter(t => (t.txn_date || '').slice(0, 10) === todayStr);
        } else if (period === 'THIS_MONTH') {
            const curY = now.getFullYear();
            const curM = now.getMonth();
            list = list.filter(t => {
                const d = new Date(t.txn_date);
                return d.getFullYear() === curY && d.getMonth() === curM;
            });
        } else if (period === 'THIS_YEAR') {
            const curY = now.getFullYear();
            list = list.filter(t => {
                const d = new Date(t.txn_date);
                return d.getFullYear() === curY;
            });
        }

        if (search) {
            const s = search.toLowerCase();
            list = list.filter(t => 
                (t.product_title || '').toLowerCase().includes(s) ||
                (t.product_sku || '').toLowerCase().includes(s) ||
                (t.batch_number || '').toLowerCase().includes(s) ||
                (t.txn_number || '').toLowerCase().includes(s) ||
                (t.customer_name || '').toLowerCase().includes(s) ||
                (t.supplier_name || '').toLowerCase().includes(s)
            );
        }

        return res.json(list);
    }
}

async function getDashboardStats(req, res) {
    try {
        const [todayIn] = await db.query(`
            SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value 
            FROM transactions 
            WHERE txn_type = 'STOCK_IN' AND DATE(txn_date) = CURDATE()
        `);

        const [allTimeIn] = await db.query(`
            SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value 
            FROM transactions 
            WHERE txn_type = 'STOCK_IN'
        `);

        const [todayOut] = await db.query(`
            SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value 
            FROM transactions 
            WHERE txn_type = 'SALE' AND DATE(txn_date) = CURDATE()
        `);

        const [allTimeOut] = await db.query(`
            SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value 
            FROM transactions 
            WHERE txn_type = 'SALE'
        `);

        const [lowStock] = await db.query(`
            SELECT COUNT(p.id) AS count 
            FROM products p
            LEFT JOIN (
                SELECT product_id, SUM(available_qty) AS total_qty 
                FROM product_batches 
                GROUP BY product_id
            ) b ON p.id = b.product_id
            WHERE COALESCE(b.total_qty, 0) <= p.min_reorder_level
        `);

        const [nearExpiry] = await db.query(`
            SELECT COUNT(*) AS count 
            FROM product_batches 
            WHERE expiry_date IS NOT NULL 
              AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              AND available_qty > 0
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
        let stockInSum = 0, stockInCount = 0;
        let saleSum = 0, saleCount = 0;

        mockTransactions.forEach(t => {
            if (t.txn_type === 'STOCK_IN') {
                stockInSum += parseFloat(t.total_amount || 0);
                stockInCount++;
            } else if (t.txn_type === 'SALE') {
                saleSum += parseFloat(t.total_amount || 0);
                saleCount++;
            }
        });

        return res.json({
            todayStockIn: { count: stockInCount, value: stockInSum },
            allTimeStockIn: { count: stockInCount, value: stockInSum },
            todayStockOut: { count: saleCount, value: saleSum },
            allTimeStockOut: { count: saleCount, value: saleSum },
            lowStockCount: 1,
            nearExpiryCount: 1
        });
    }
}

module.exports = { getTransactions, getDashboardStats };
