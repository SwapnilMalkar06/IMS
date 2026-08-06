// ====================================================================
// Phase 2: Backend Dev & Domain Engine - Product Catalog Controller
// ====================================================================

const db = require('../config/db');
const { mockProducts, mockBatches, recalculateAllStock } = require('../config/store');

async function getProducts(req, res) {
    try {
        const { domain, search, category_id } = req.query;
        let query = `
            SELECT 
                p.*, 
                c.name AS category_name,
                COALESCE(SUM(b.available_qty), 0) AS total_stock,
                COUNT(b.id) AS batch_count
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_batches b ON p.id = b.product_id
            WHERE 1=1
        `;
        const params = [];

        if (domain && domain !== 'ALL') {
            query += ` AND p.domain_preset = ?`;
            params.push(domain);
        }
        if (category_id) {
            query += ` AND p.category_id = ?`;
            params.push(category_id);
        }
        if (search) {
            query += ` AND (p.title LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        query += ` GROUP BY p.id ORDER BY p.title ASC`;

        const [rows] = await db.query(query, params);
        return res.json(rows);
    } catch (err) {
        console.warn('⚠️ MySQL not accessible, returning fallback mock products:', err.message);
        recalculateAllStock();

        const { domain, search } = req.query;
        let filtered = mockProducts;
        if (domain && domain !== 'ALL') {
            filtered = filtered.filter(p => p.domain_preset === domain);
        }
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(p => p.title.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
        }
        return res.json(filtered);
    }
}

async function createProduct(req, res) {
    try {
        const { sku, barcode, title, category_id, unit_of_measure, min_reorder_level, domain_preset, brand, storage_location } = req.body;
        
        if (!sku || !title || !category_id) {
            return res.status(400).json({ error: 'SKU, Title, and Category ID are required.' });
        }

        const [result] = await db.query(`
            INSERT INTO products (sku, barcode, title, category_id, unit_of_measure, min_reorder_level, domain_preset, brand, storage_location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            sku, barcode || null, title, category_id, unit_of_measure || 'Pcs', min_reorder_level || 10, domain_preset || 'GENERAL', brand || null, storage_location || null
        ]);

        return res.status(201).json({ id: result.insertId, message: 'Product created successfully!' });
    } catch (err) {
        console.warn('⚠️ MySQL unavailable for createProduct, adding to mock state');
        const newObj = {
            id: Date.now(),
            sku: req.body.sku || `SKU-${Date.now().toString().slice(-4)}`,
            barcode: req.body.barcode || null,
            title: req.body.title || 'New Item',
            category_id: req.body.category_id || 1,
            category_name: req.body.category_name || 'General',
            unit_of_measure: req.body.unit_of_measure || 'Pcs',
            total_stock: 0,
            min_reorder_level: req.body.min_reorder_level || 10,
            domain_preset: req.body.domain_preset || 'GENERAL'
        };
        mockProducts.unshift(newObj);
        mockBatches[newObj.id] = [];
        return res.status(201).json({ id: newObj.id, message: 'Product added (Demo Mode)!' });
    }
}

async function updateProduct(req, res) {
    try {
        const { id } = req.params;
        const { sku, barcode, title, category_id, unit_of_measure, min_reorder_level, domain_preset, brand, storage_location } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Product Title is required.' });
        }

        const [result] = await db.query(`
            UPDATE products 
            SET sku = ?, barcode = ?, title = ?, category_id = ?, unit_of_measure = ?, min_reorder_level = ?, domain_preset = ?, brand = ?, storage_location = ?
            WHERE id = ?
        `, [
            sku, barcode || null, title, category_id || 1, unit_of_measure || 'Pcs', min_reorder_level || 10, domain_preset || 'GENERAL', brand || null, storage_location || null, id
        ]);

        return res.json({ message: 'Product updated successfully!' });
    } catch (err) {
        const { id } = req.params;
        const index = mockProducts.findIndex(p => p.id == id);
        if (index !== -1) {
            mockProducts[index] = { ...mockProducts[index], ...req.body };
        }
        return res.json({ message: 'Product updated (Demo Mode)!' });
    }
}

async function deleteProduct(req, res) {
    try {
        const { id } = req.params;

        await db.query(`DELETE FROM product_batches WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM products WHERE id = ?`, [id]);

        return res.json({ message: 'Product deleted successfully from inventory!' });
    } catch (err) {
        const { id } = req.params;
        const index = mockProducts.findIndex(p => p.id == id);
        if (index !== -1) {
            mockProducts.splice(index, 1);
            delete mockBatches[id];
        }
        return res.json({ message: 'Product deleted (Demo Mode)!' });
    }
}

module.exports = { getProducts, createProduct, updateProduct, deleteProduct };
