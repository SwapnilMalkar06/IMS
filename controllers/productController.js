// ====================================================================
// Phase 2: Backend Dev & Domain Engine - Product Catalog Controller
// ====================================================================

const db = require('../config/db');

// Fallback demo products if DB is not connected yet
let mockProducts = [
    { id: 1, sku: 'PHARM-5001', barcode: '8901001002001', title: 'Paracetamol 500mg Tablets (Box of 100)', category_id: 1, category_name: 'Pharmaceuticals', unit_of_measure: 'Boxes', total_stock: 97, min_reorder_level: 15, domain_preset: 'PHARMACY' },
    { id: 2, sku: 'PHARM-5002', barcode: '8901001002002', title: 'Amoxicillin 250mg Capsules', category_id: 1, category_name: 'Pharmaceuticals', unit_of_measure: 'Boxes', total_stock: 40, min_reorder_level: 10, domain_preset: 'PHARMACY' },
    { id: 3, sku: 'ELEC-1001', barcode: '8902002003001', title: 'Wireless Ergonomic Mouse', category_id: 3, category_name: 'Consumer Electronics', unit_of_measure: 'Pcs', total_stock: 30, min_reorder_level: 5, domain_preset: 'ELECTRONICS' },
    { id: 4, sku: 'FOOD-3001', barcode: '8903003004001', title: 'Whole Wheat Bread 400g', category_id: 2, category_name: 'Packaged Foods & Dairy', unit_of_measure: 'Pcs', total_stock: 18, min_reorder_level: 25, domain_preset: 'GROCERY' }
];

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
        const { domain } = req.query;
        let filtered = mockProducts;
        if (domain && domain !== 'ALL') {
            filtered = mockProducts.filter(p => p.domain_preset === domain);
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
        const newObj = { id: Date.now(), ...req.body, total_stock: 0 };
        mockProducts.push(newObj);
        return res.status(201).json({ id: newObj.id, message: 'Product added (Demo Mode)!' });
    }
}

// PUT /api/products/:id (Edit Product Title, SKU, Category, UOM, Reorder Level)
async function updateProduct(req, res) {
    try {
        const { id } = req.params;
        const { sku, barcode, title, category_id, unit_of_measure, min_reorder_level, domain_preset, brand, storage_location } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Product Title is required.' });
        }

        const [result] = await db.query(`
            UPDATE products 
            SET sku = ?,
                barcode = ?,
                title = ?,
                category_id = ?,
                unit_of_measure = ?,
                min_reorder_level = ?,
                domain_preset = ?,
                brand = ?,
                storage_location = ?
            WHERE id = ?
        `, [
            sku, barcode || null, title, category_id || 1, unit_of_measure || 'Pcs', min_reorder_level || 10, domain_preset || 'GENERAL', brand || null, storage_location || null, id
        ]);

        return res.json({ message: 'Product updated successfully!' });
    } catch (err) {
        console.warn('⚠️ MySQL unavailable for updateProduct, updating mock state');
        const { id } = req.params;
        const index = mockProducts.findIndex(p => p.id == id);
        if (index !== -1) {
            mockProducts[index] = { ...mockProducts[index], ...req.body };
        }
        return res.json({ message: 'Product updated (Demo Mode)!' });
    }
}

// DELETE /api/products/:id (Delete Product from Inventory)
async function deleteProduct(req, res) {
    try {
        const { id } = req.params;

        // Delete associated product batches & product
        await db.query(`DELETE FROM product_batches WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM products WHERE id = ?`, [id]);

        return res.json({ message: 'Product deleted successfully from inventory!' });
    } catch (err) {
        console.warn('⚠️ MySQL unavailable for deleteProduct, deleting from mock state');
        const { id } = req.params;
        mockProducts = mockProducts.filter(p => p.id != id);
        return res.json({ message: 'Product deleted (Demo Mode)!' });
    }
}

module.exports = { getProducts, createProduct, updateProduct, deleteProduct, mockProducts };
