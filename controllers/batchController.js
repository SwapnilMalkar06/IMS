// ====================================================================
// Phase 2: Domain Engine - FEFO Batch Selection & Batch Offer Controller
// ====================================================================

const db = require('../config/db');
const { getBatchesForProduct } = require('../config/store');

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
        const fallback = getBatchesForProduct(pid);
        return res.json(fallback);
    }
}

module.exports = { getProductBatches };
