const db = require('../config/db');

async function seedWriteOffs() {
    console.log('🌱 Seeding Stock Movement, Damage Write-Offs & Vendor Return Data into MySQL...');

    try {
        const [products] = await db.query(`SELECT id, title, sku FROM products LIMIT 5`);

        if (products.length === 0) {
            console.log('No products found to attach write-offs.');
            process.exit(0);
        }

        const p1 = products[0]; // Paracetamol / Product 1
        const p2 = products[1] || p1; // Mouse / Product 2
        const p3 = products[2] || p1; // Green Tea / Product 3

        const writeOffs = [
            {
                txn_number: `WO-${Date.now()}-1`,
                txn_type: 'DAMAGE_WRITE_OFF',
                product_id: p1.id,
                quantity: 12,
                unit_price: 15.00,
                total_amount: 180.00,
                notes: '🌧️ Water leakage damage in Storage Rack B-2 during heavy rain monsoon',
                invoice_ref: 'WO-DMG-2026-001',
                txn_date: '2026-08-08 11:30:00'
            },
            {
                txn_number: `WO-${Date.now()}-2`,
                txn_type: 'DAMAGE_WRITE_OFF',
                product_id: p2.id,
                quantity: 2,
                unit_price: 899.00,
                total_amount: 1798.00,
                notes: '⚡ Hardware circuit defective / dropped during transit unload',
                invoice_ref: 'WO-DMG-2026-002',
                txn_date: '2026-08-07 16:45:00'
            },
            {
                txn_number: `VR-${Date.now()}-1`,
                txn_type: 'VENDOR_RETURN',
                product_id: p3.id,
                quantity: 15,
                unit_price: 35.00,
                total_amount: 525.00,
                notes: '📦 Returned to Metro Wholesalers due to damaged outer seal packaging',
                invoice_ref: 'RET-VEND-8821',
                txn_date: '2026-08-06 09:15:00'
            },
            {
                txn_number: `IU-${Date.now()}-1`,
                txn_type: 'INTERNAL_USE',
                product_id: p1.id,
                quantity: 5,
                unit_price: 15.00,
                total_amount: 75.00,
                notes: '🏥 First Aid Kit restocking for staff welfare desk',
                invoice_ref: 'INT-USE-104',
                txn_date: '2026-08-05 14:00:00'
            },
            {
                txn_number: `ADJ-${Date.now()}-1`,
                txn_type: 'ADJUSTMENT',
                product_id: p2.id,
                quantity: 3,
                unit_price: 899.00,
                total_amount: 2697.00,
                notes: '📋 Monthly physical inventory count audit variance shortage correction',
                invoice_ref: 'AUDIT-ADJ-09',
                txn_date: '2026-07-28 17:30:00'
            }
        ];

        for (const wo of writeOffs) {
            await db.query(`
                INSERT INTO transactions 
                (txn_number, txn_type, product_id, quantity, unit_price, discount_amount, total_amount, remarks, invoice_ref, user_id, txn_date)
                VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, ?, 1, ?)
                ON DUPLICATE KEY UPDATE remarks = VALUES(remarks)
            `, [wo.txn_number, wo.txn_type, wo.product_id, wo.quantity, wo.unit_price, wo.total_amount, wo.notes, wo.invoice_ref, wo.txn_date]);
        }


        console.log('✅ Successfully seeded 5 realistic Stock Movement, Write-Off, & Adjustment records into MySQL database!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding write-offs:', err);
        process.exit(1);
    }
}

seedWriteOffs();
