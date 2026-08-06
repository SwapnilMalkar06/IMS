// ====================================================================
// Phase 2: Backend Dev - Stock In Controller (Receiving Entry)
// ====================================================================

const db = require('../config/db');
const { mockProducts } = require('./productController');
const { mockBatches } = require('./batchController');

async function processStockIn(req, res) {
    let connection;
    try {
        const {
            product_id,
            product_title,
            sku,
            barcode,
            category_id,
            unit_of_measure,
            domain_preset,
            batch_number,
            expiry_date,
            serial_number,
            quantity,
            purchase_price,
            selling_price,
            batch_discount_percent,
            offer_description,
            supplier_id,
            invoice_ref,
            payment_status,
            user_id,
            remarks
        } = req.body;

        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            return res.status(400).json({ error: 'Valid Quantity (> 0) is required.' });
        }

        const user = user_id || 1;
        const batchNo = batch_number || `BATCH-${Date.now().toString().slice(-6)}`;
        const pPrice = parseFloat(purchase_price) || 0;
        const sPrice = parseFloat(selling_price) || 0;

        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            let targetProductId = product_id;

            // 1. If product_id is not provided or invalid, find or auto-create product in master catalog
            if (!targetProductId) {
                const titleToUse = product_title || 'New Received Item';
                const skuToUse = sku || `SKU-${Date.now().toString().slice(-6)}`;

                // Check if SKU or title already exists in products table
                const [existingProd] = await connection.query(`
                    SELECT id FROM products WHERE sku = ? OR title = ?
                `, [skuToUse, titleToUse]);

                if (existingProd.length > 0) {
                    targetProductId = existingProd[0].id;
                } else {
                    // Create new Product in Catalog
                    const [newProdResult] = await connection.query(`
                        INSERT INTO products 
                        (sku, barcode, title, category_id, unit_of_measure, min_reorder_level, domain_preset)
                        VALUES (?, ?, ?, ?, ?, 10, ?)
                    `, [
                        skuToUse,
                        barcode || null,
                        titleToUse,
                        category_id || 1,
                        unit_of_measure || 'Pcs',
                        domain_preset || 'GENERAL'
                    ]);
                    targetProductId = newProdResult.insertId;
                }
            }

            // 2. Check if batch already exists for this target product
            const [existingBatch] = await connection.query(`
                SELECT id, available_qty FROM product_batches 
                WHERE product_id = ? AND batch_number = ?
            `, [targetProductId, batchNo]);

            let batchId;
            if (existingBatch.length > 0) {
                batchId = existingBatch[0].id;
                await connection.query(`
                    UPDATE product_batches 
                    SET available_qty = available_qty + ?,
                        purchase_price = ?,
                        selling_price = ?
                    WHERE id = ?
                `, [qty, pPrice, sPrice, batchId]);
            } else {
                const [newBatch] = await connection.query(`
                    INSERT INTO product_batches 
                    (batch_number, product_id, expiry_date, serial_number, available_qty, purchase_price, selling_price, batch_discount_percent, offer_description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    batchNo,
                    targetProductId,
                    expiry_date || null,
                    serial_number || null,
                    qty,
                    pPrice,
                    sPrice,
                    batch_discount_percent || 0,
                    offer_description || null
                ]);
                batchId = newBatch.insertId;
            }

            // 3. Record Transaction Log
            const txnNumber = `TXN-IN-${Date.now()}`;
            const totalCost = parseFloat((qty * pPrice).toFixed(2));

            await connection.query(`
                INSERT INTO transactions 
                (txn_number, txn_type, product_id, batch_id, quantity, unit_price, total_amount, supplier_id, invoice_ref, payment_status, remarks, user_id)
                VALUES (?, 'STOCK_IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                txnNumber,
                targetProductId,
                batchId,
                qty,
                pPrice,
                totalCost,
                supplier_id || null,
                invoice_ref || 'RECEIPT-IN',
                payment_status || 'PAID',
                remarks || 'Stock In Entry',
                user
            ]);

            await connection.commit();
            return res.status(201).json({ 
                message: 'Stock In entry recorded successfully in MySQL!', 
                productId: targetProductId,
                txnNumber, 
                batchId 
            });
        } catch (dbErr) {
            if (connection) {
                try { await connection.rollback(); } catch (e) {}
            }

            // Fallback for Demo Mode (creates/updates in mock state)
            let targetProd = mockProducts.find(p => p.id == product_id || p.title === product_title);
            if (!targetProd) {
                targetProd = {
                    id: Date.now(),
                    sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
                    title: product_title || 'New Item',
                    category_id: category_id || 1,
                    category_name: 'General Merchandise',
                    unit_of_measure: unit_of_measure || 'Pcs',
                    total_stock: qty,
                    min_reorder_level: 10,
                    domain_preset: 'GENERAL'
                };
                mockProducts.push(targetProd);
            } else {
                targetProd.total_stock = (targetProd.total_stock || 0) + qty;
            }

            // Add demo batch
            if (!mockBatches[targetProd.id]) mockBatches[targetProd.id] = [];
            mockBatches[targetProd.id].push({
                id: Date.now(),
                batch_number: batchNo,
                product_id: targetProd.id,
                expiry_date: expiry_date || '2027-12-31',
                available_qty: qty,
                purchase_price: pPrice,
                selling_price: sPrice,
                batch_discount_percent: batch_discount_percent || 0,
                offer_description: offer_description || 'New Stock Arrival'
            });

            return res.status(201).json({
                message: 'Stock In entry recorded successfully (Demo Mode)!',
                productId: targetProd.id,
                txnNumber: `TXN-IN-${Date.now()}`
            });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Failed to record Stock In', details: err.message });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = { processStockIn };
