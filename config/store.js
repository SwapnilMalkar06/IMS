// ====================================================================
// Centralized Shared Memory Store for Demo / Fallback Mode
// ====================================================================

const mockProducts = [
    { id: 1, sku: 'PHARM-5001', barcode: '8901001002001', title: 'Paracetamol 500mg Tablets (Box of 100)', category_id: 1, category_name: 'Pharmaceuticals', unit_of_measure: 'Boxes', total_stock: 97, min_reorder_level: 15, domain_preset: 'PHARMACY' },
    { id: 2, sku: 'PHARM-5002', barcode: '8901001002002', title: 'Amoxicillin 250mg Capsules', category_id: 1, category_name: 'Pharmaceuticals', unit_of_measure: 'Boxes', total_stock: 40, min_reorder_level: 10, domain_preset: 'PHARMACY' },
    { id: 3, sku: 'ELEC-1001', barcode: '8902002003001', title: 'Wireless Ergonomic Mouse', category_id: 3, category_name: 'Consumer Electronics', unit_of_measure: 'Pcs', total_stock: 30, min_reorder_level: 5, domain_preset: 'ELECTRONICS' },
    { id: 4, sku: 'FOOD-3001', barcode: '8903003004001', title: 'Whole Wheat Bread 400g', category_id: 2, category_name: 'Packaged Foods & Dairy', unit_of_measure: 'Pcs', total_stock: 18, min_reorder_level: 25, domain_preset: 'GROCERY' }
];

const mockBatches = {
    1: [
        { id: 1, batch_number: 'BATCH-PHARM-2026A', product_id: 1, expiry_date: '2026-08-20', available_qty: 12, purchase_price: 10.00, selling_price: 15.00, batch_discount_percent: 20.00, offer_description: '🔥 20% Near-Expiry Clearance' },
        { id: 2, batch_number: 'BATCH-PHARM-2026B', product_id: 1, expiry_date: '2027-04-15', available_qty: 85, purchase_price: 11.50, selling_price: 16.50, batch_discount_percent: 0.00, offer_description: 'Fresh Batch' }
    ],
    2: [
        { id: 3, batch_number: 'BATCH-AMOX-2026X', product_id: 2, expiry_date: '2026-11-30', available_qty: 40, purchase_price: 18.00, selling_price: 25.00, batch_discount_percent: 5.00, offer_description: '5% Seasonal Discount' }
    ]
};

const mockTransactions = [
    { 
        id: 1,
        txn_date: new Date().toISOString(), 
        txn_number: 'TXN-IN-20260801-01', 
        txn_type: 'STOCK_IN', 
        product_title: 'Paracetamol 500mg Tablets (Box of 100)', 
        product_sku: 'PHARM-5001', 
        batch_number: 'BATCH-PHARM-2026A', 
        quantity: 100, 
        unit_price: 10.00, 
        total_amount: 1000.00, 
        supplier_name: 'PharmaSupply Co.', 
        user_name: 'Super Admin' 
    },
    { 
        id: 2,
        txn_date: new Date().toISOString(), 
        txn_number: 'TXN-OUT-20260802-01', 
        txn_type: 'SALE', 
        product_title: 'Paracetamol 500mg Tablets (Box of 100)', 
        product_sku: 'PHARM-5001', 
        batch_number: 'BATCH-PHARM-2026A', 
        quantity: -3, 
        unit_price: 15.00, 
        total_amount: 45.00, 
        customer_name: 'Walk-in Customer', 
        user_name: 'Inventory Clerk' 
    }
];

function getBatchesForProduct(productId) {
    if (!productId) return [];
    return mockBatches[productId] || mockBatches[String(productId)] || mockBatches[Number(productId)] || [];
}

function getProductTotalStock(productId) {
    const batches = getBatchesForProduct(productId);
    return batches.reduce((sum, b) => sum + (parseInt(b.available_qty) || 0), 0);
}

function recalculateAllStock() {
    mockProducts.forEach(p => {
        p.total_stock = getProductTotalStock(p.id);
    });
}

function addMockTransaction(txn) {
    mockTransactions.unshift({
        id: Date.now(),
        txn_date: new Date().toISOString(),
        ...txn
    });
}

module.exports = { 
    mockProducts, 
    mockBatches, 
    mockTransactions, 
    getBatchesForProduct, 
    getProductTotalStock, 
    recalculateAllStock,
    addMockTransaction 
};
