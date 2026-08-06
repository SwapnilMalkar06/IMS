// ====================================================================
// Phase 2: Domain Engine & Backend Dev - Stock Out Controller
// ====================================================================

const db = require('../config/db');
const { mockBatches } = require('./batchController');

async function processStockOut(req, res) {
    let connection;
    try {
        const {
            product_id,
            batch_id,
            quantity,
            txn_type,
            unit_price,
            discount_amount,
            tax_amount,
            customer_name,
            dept_name,
            invoice_ref,
            user_id,
            remarks
        } = req.body;

        if (!product_id || !batch_id || !quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Product ID, Batch ID, and valid Outgoing Quantity are required.' });
        }

        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            // Lock & Verify batch available stock (Stock Guard Protection)
            const [batchRows] = await connection.query(`
                SELECT id, available_qty, selling_price, batch_discount_percent 
                FROM product_batches 
                WHERE id = ? FOR UPDATE
            `, [batch_id]);

            if (batchRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Selected batch not found.' });
            }

            const batch = batchRows[0];
            if (batch.available_qty < quantity) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: `Insufficient stock in selected batch! Requested: ${quantity}, Available: ${batch.available_qty}` 
                });
            }

            // Deduct from batch
            await connection.query(`
                UPDATE product_batches 
                SET available_qty = available_qty - ? 
                WHERE id = ?
            `, [quantity, batch_id]);

            // Calculate totals
            const type = txn_type || 'SALE';
            const price = unit_price !== undefined ? parseFloat(unit_price) : parseFloat(batch.selling_price);
            const disc = discount_amount ? parseFloat(discount_amount) : 0;
            const tax = tax_amount ? parseFloat(tax_amount) : 0;
            const total = parseFloat(((quantity * price) - disc + tax).toFixed(2));
            const txnNumber = `TXN-OUT-${Date.now()}`;
            const user = user_id || 1;

            // Record transaction
            await connection.query(`
                INSERT INTO transactions 
                (txn_number, txn_type, product_id, batch_id, quantity, unit_price, discount_amount, tax_amount, total_amount, customer_name, dept_name, invoice_ref, remarks, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                txnNumber, type, product_id, batch_id, quantity, price, disc, tax, total,
                customer_name || null, dept_name || null, invoice_ref || `BILL-${Date.now().toString().slice(-6)}`,
                remarks || `Stock Out (${type})`, user
            ]);

            await connection.commit();
            return res.status(201).json({ 
                message: 'Stock Out processed successfully!', 
                txnNumber, 
                remainingQty: batch.available_qty - quantity 
            });
        } catch (dbErr) {
            if (connection) {
                try { await connection.rollback(); } catch (e) {}
            }

            // Fallback Stock Guard validation in Demo Mode
            const productBatches = mockBatches[product_id] || [
                { id: 1, available_qty: 12, selling_price: 15.00 }
            ];
            const targetBatch = productBatches.find(b => b.id == batch_id) || productBatches[0];

            if (targetBatch && targetBatch.available_qty < quantity) {
                return res.status(400).json({
                    error: `Insufficient stock in selected batch! Requested: ${quantity}, Available: ${targetBatch.available_qty}`
                });
            }

            return res.status(201).json({
                message: 'Stock Out processed (Demo Mode)!',
                txnNumber: `TXN-OUT-${Date.now()}`,
                remainingQty: Math.max(0, (targetBatch ? targetBatch.available_qty : 10) - quantity)
            });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Failed to process Stock Out', details: err.message });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = { processStockOut };
