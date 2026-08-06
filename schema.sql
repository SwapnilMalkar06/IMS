-- ====================================================================
-- Inventory Management System - MySQL 8.0 Database Schema
-- Phase 1: Database Architect Agent Output
-- Target DB: inventory_system (MySQL 8.0 CE)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS inventory_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_system;

-- 1. Users Table (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'MANAGER', 'CLERK', 'AUDITOR') NOT NULL DEFAULT 'CLERK',
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role)
) ENGINE=InnoDB;

-- 2. Categories Table (Supports Multi-Domain Presets)
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    domain_type ENUM('GENERAL', 'PHARMACY', 'GROCERY', 'ELECTRONICS', 'APPAREL', 'HARDWARE') DEFAULT 'GENERAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Suppliers / Vendors Table
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(120),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Products Table (Base Inventory Catalog)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    barcode VARCHAR(100) UNIQUE,
    title VARCHAR(200) NOT NULL,
    category_id INT NOT NULL,
    unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'Pcs', -- Pcs, Kg, Liters, Boxes, Packs, Meters
    min_reorder_level INT DEFAULT 10,
    domain_preset ENUM('GENERAL', 'PHARMACY', 'GROCERY', 'ELECTRONICS', 'APPAREL', 'HARDWARE') DEFAULT 'GENERAL',
    brand VARCHAR(100),
    storage_location VARCHAR(100), -- Bin/Shelf number
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_product_sku (sku),
    INDEX idx_product_barcode (barcode),
    INDEX idx_product_category (category_id)
) ENGINE=InnoDB;

-- 5. Product Batches Table (Supports Expiry, Dynamic Pricing & Batch Offers)
CREATE TABLE IF NOT EXISTS product_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_number VARCHAR(100) NOT NULL,
    product_id INT NOT NULL,
    expiry_date DATE NULL, -- Vital for Pharmacy & Food
    serial_number VARCHAR(100) NULL, -- Vital for Electronics
    available_qty INT NOT NULL DEFAULT 0,
    purchase_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    batch_discount_percent DECIMAL(5, 2) DEFAULT 0.00, -- Clearance or batch offer %
    offer_description VARCHAR(200) NULL, -- E.g. "20% Near Expiry Clearance" or "Buy 2 Get 1 Free"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_batch_product (batch_number, product_id),
    INDEX idx_batch_expiry (expiry_date),
    INDEX idx_batch_qty (available_qty)
) ENGINE=InnoDB;

-- 6. Daily Transactions Table (Stock In, Stock Out, Audit Ledger)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    txn_number VARCHAR(50) NOT NULL UNIQUE,
    txn_type ENUM('STOCK_IN', 'SALE', 'INTERNAL_USE', 'DAMAGE_WRITE_OFF', 'VENDOR_RETURN', 'ADJUSTMENT') NOT NULL,
    product_id INT NOT NULL,
    batch_id INT NULL,
    quantity INT NOT NULL, -- Positive for Stock In, Negative/Positive magnitude depending on logic
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    supplier_id INT NULL, -- Set on STOCK_IN or VENDOR_RETURN
    customer_name VARCHAR(150) NULL, -- Set on SALE
    dept_name VARCHAR(100) NULL, -- Set on INTERNAL_USE
    invoice_ref VARCHAR(100) NULL, -- Bill # or Supplier Invoice #
    payment_status ENUM('PAID', 'PENDING', 'CREDIT', 'PARTIAL') DEFAULT 'PAID',
    remarks TEXT NULL,
    user_id INT NOT NULL, -- Employee who logged the transaction
    txn_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_txn_date (txn_date),
    INDEX idx_txn_type (txn_type),
    INDEX idx_txn_product (product_id)
) ENGINE=InnoDB;

-- ====================================================================
-- SEED DEMO DATA FOR IMMEDIATE TESTING
-- ====================================================================

-- Demo Users (Password for all demo users is 'password123')
INSERT INTO users (name, email, password_hash, role) VALUES
('Super Admin', 'admin@inventory.com', 'scrypt$dummyhash$admin123', 'ADMIN'),
('Store Manager', 'manager@inventory.com', 'scrypt$dummyhash$manager123', 'MANAGER'),
('Inventory Clerk', 'clerk@inventory.com', 'scrypt$dummyhash$clerk123', 'CLERK'),
('Auditor Viewer', 'auditor@inventory.com', 'scrypt$dummyhash$auditor123', 'AUDITOR')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Demo Categories
INSERT INTO categories (name, description, domain_type) VALUES
('Pharmaceuticals', 'Medicines, Vaccines & Healthcare', 'PHARMACY'),
('Packaged Foods & Dairy', 'Fresh food, canned goods & beverages', 'GROCERY'),
('Consumer Electronics', 'Mobiles, Laptops & Accessories', 'ELECTRONICS'),
('General Merchandise', 'Hardware, Tools & Stationery', 'GENERAL')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Demo Suppliers
INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES
('PharmaSupply Co.', 'Dr. Robert Vance', '+1-555-0192', 'orders@pharmasupply.com', '452 Medical Parkway, Hub City'),
('Global Electronics Ltd.', 'Sarah Jenkins', '+1-555-0388', 'sales@globalelectronics.com', '101 Tech Blvd, Silicon Valley'),
('Metro Wholesalers', 'Mike Ross', '+1-555-0471', 'supply@metrowholesale.com', '88 Commercial Street, Metro City')
ON DUPLICATE KEY UPDATE contact_person=VALUES(contact_person);

-- Demo Products
INSERT INTO products (sku, barcode, title, category_id, unit_of_measure, min_reorder_level, domain_preset, brand, storage_location) VALUES
('PHARM-5001', '8901001002001', 'Paracetamol 500mg Tablets (Box of 100)', 1, 'Boxes', 15, 'PHARMACY', 'HealthPharma', 'Rack A-1'),
('PHARM-5002', '8901001002002', 'Amoxicillin 250mg Capsules', 1, 'Boxes', 10, 'PHARMACY', 'CureLabs', 'Rack A-2'),
('ELEC-1001', '8902002003001', 'Wireless Ergonomic Mouse', 3, 'Pcs', 5, 'ELECTRONICS', 'TechGear', 'Shelf B-4'),
('ELEC-1002', '8902002003002', 'USB-C Fast Charging Cable 2m', 3, 'Pcs', 20, 'ELECTRONICS', 'PowerFast', 'Shelf B-5'),
('FOOD-3001', '8903003004001', 'Whole Wheat Bread 400g', 2, 'Pcs', 25, 'GROCERY', 'FreshBake', 'Counter C-1')
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- Demo Product Batches (With Expiry, Prices, and Offers)
INSERT INTO product_batches (batch_number, product_id, expiry_date, available_qty, purchase_price, selling_price, batch_discount_percent, offer_description) VALUES
('BATCH-PHARM-2026A', 1, '2026-08-20', 12, 10.00, 15.00, 20.00, '🔥 20% Near-Expiry Clearance'),
('BATCH-PHARM-2026B', 1, '2027-04-15', 85, 11.50, 16.50, 0.00, 'Fresh Batch'),
('BATCH-AMOX-2026X', 2, '2026-11-30', 40, 18.00, 25.00, 5.00, '5% Seasonal Discount'),
('BATCH-ELEC-MOUSE1', 3, NULL, 30, 12.00, 24.99, 0.00, 'Regular Price'),
('BATCH-FOOD-BREAD1', 5, '2026-08-08', 18, 1.20, 2.50, 10.00, '10% Daily Baked Fresh')
ON DUPLICATE KEY UPDATE available_qty=VALUES(available_qty);

-- Demo Transactions
INSERT INTO transactions (txn_number, txn_type, product_id, batch_id, quantity, unit_price, total_amount, supplier_id, invoice_ref, user_id, remarks) VALUES
('TXN-IN-20260801-01', 'STOCK_IN', 1, 1, 100, 10.00, 1000.00, 1, 'INV-PHARM-992', 1, 'Initial Stock Receipt'),
('TXN-OUT-20260802-01', 'SALE', 1, 1, 2, 12.00, 24.00, NULL, 'BILL-1001', 3, 'Direct Counter Sale'),
('TXN-OUT-20260803-01', 'INTERNAL_USE', 4, NULL, 2, 5.00, 10.00, NULL, 'REF-HR-04', 2, 'Issued USB cables to HR Team')
ON DUPLICATE KEY UPDATE remarks=VALUES(remarks);
