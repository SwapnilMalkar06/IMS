// ====================================================================
// Phase 2: Domain Engine - FEFO Batch Selection & Batch Offer Controller
// ====================================================================

const db = require('../config/db');

const mockBatches = {
    1: [
        { id: 1, batch_number: 'BATCH-PHARM-2026A', product_id: 1, expiry_date: '2026-08-20', available_qty: 12, purchase_price: 10.00, selling_price: 15.00, batch_discount_percent: 20.00, offer_description: '🔥 20% Near-Expiry Clearance' },
        { id: 2, batch_number: 'BATCH-PHARM-2026B', product_id: 1, expiry_date: '2027-04-15', available_qty: 85, purchase_price: 11.50, selling_price: 16.50, batch_discount_percent: 0.00, offer_description: 'Fresh Batch' }
    ],
    2: [
        { id: 3, batch_number: 'BATCH-AMOX-2026X', product_id: 2, expiry_date: '2026-11-30', available_qty: 40, purchase_price: 18.00, selling_price: 25.00, batch_discount_percent: 5.00, offer_description: '5% Seasonal Discount' }
    ]
};

async function getProductBatches(req, res) {
    try {
        const { productId } = req.params;
        const [rows] = await db.query(`
            SELECT 
                b.*,
                DATEDIFF(b.expiry_date, CURDATE()) AS days_to_expiry,
                CASE 
                    WHEN b.expiry_date IS NOT NULL AND DATEDIFF(b.expiry_date, CURDATE()) <= 30 THEN 1 
                    ELSE 0 
                END AS is_near_expiry
            FROM product_batches b
            WHERE b.product_id = ? AND b.available_qty > 0
            ORDER BY 
                CASE WHEN b.expiry_date IS NULL THEN 1 ELSE 0 END, 
                b.expiry_date ASC,
                b.id ASC
        `, [productId]);

        return res.json(rows);
    } catch (err) {
        console.warn('⚠️ MySQL not accessible, returning mock batches for product:', req.params.productId);
        const pid = req.params.productId;
        const fallback = mockBatches[pid] || [
            { id: 99, batch_number: `BATCH-DEMO-${pid}`, product_id: parseInt(pid), expiry_date: '2027-01-01', available_qty: 50, purchase_price: 10.00, selling_price: 15.00, batch_discount_percent: 0, offer_description: 'Regular Stock' }
        ];
        return res.json(fallback);
    }
}

module.exports = { getProductBatches, mockBatches };
