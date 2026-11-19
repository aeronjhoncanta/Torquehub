-- TorqueHub Motor Database Schema
-- Complete SQL schema for the torquehubmotor database

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS torquehubmotor;
USE torquehubmotor;

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS service_images;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    dealership_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture VARCHAR(500) NULL,
    bio TEXT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255) NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_verified (verified)
);

-- Products table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image VARCHAR(500) NULL,
    category VARCHAR(100) NULL,
    brand VARCHAR(100) NULL,
    condition VARCHAR(50) DEFAULT 'New',
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_brand (brand),
    INDEX idx_condition (condition),
    INDEX idx_deleted_at (deleted_at)
);

-- Services table
CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) NULL,
    duration DECIMAL(5, 2) NULL COMMENT 'Duration in hours',
    status ENUM('Active', 'Inactive', 'Pending') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_price (price)
);

-- Service Images table
CREATE TABLE service_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    image_name VARCHAR(255) NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    INDEX idx_service_id (service_id),
    INDEX idx_is_primary (is_primary),
    INDEX idx_sort_order (sort_order)
);

-- Transactions table
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NULL,
    service_id INT NULL,
    quantity INT DEFAULT 1,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NULL,
    payment_status ENUM('Pending', 'Completed', 'Failed', 'Refunded') DEFAULT 'Pending',
    shipping_address TEXT NULL,
    notes TEXT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_product_id (product_id),
    INDEX idx_service_id (service_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_transaction_date (transaction_date)
);

-- Insert default admin user
INSERT INTO users (full_name, email, dealership_name, password_hash, verified, role) VALUES 
('Admin User', 'admin@torquehub.com', 'TorqueHub Admin', '$2a$10$defaultadminpasswordhash', TRUE, 'admin');

-- Insert sample products
INSERT INTO products (name, description, price, category, brand, condition) VALUES 
('Motorcycle Helmet', 'High-quality safety helmet for motorcycle riders', 299.99, 'Safety Gear', 'BrandX', 'New'),
('Motorcycle Jacket', 'Leather jacket with safety padding', 199.99, 'Apparel', 'BrandY', 'New'),
('Motorcycle Gloves', 'Protective riding gloves', 49.99, 'Safety Gear', 'BrandZ', 'New'),
('Motorcycle Boots', 'Sturdy riding boots with ankle protection', 159.99, 'Footwear', 'BrandA', 'New'),
('Motorcycle Chain', 'Heavy-duty motorcycle chain', 89.99, 'Parts', 'BrandB', 'New');

-- Insert sample services
INSERT INTO services (name, description, price, category, duration, status) VALUES 
('Oil Change', 'Complete oil change service for motorcycles', 45.00, 'Maintenance', 1.0, 'Active'),
('Tire Replacement', 'Professional tire replacement service', 120.00, 'Maintenance', 2.0, 'Active'),
('Brake Service', 'Complete brake system inspection and service', 85.00, 'Maintenance', 1.5, 'Active'),
('Engine Tune-up', 'Complete engine tune-up and optimization', 150.00, 'Maintenance', 3.0, 'Active'),
('Chain Lubrication', 'Chain cleaning and lubrication service', 25.00, 'Maintenance', 0.5, 'Active'),
('Battery Replacement', 'Motorcycle battery replacement service', 75.00, 'Electrical', 1.0, 'Active'),
('Electrical Diagnostics', 'Complete electrical system diagnostics', 60.00, 'Electrical', 1.5, 'Active'),
('Custom Paint Job', 'Professional motorcycle paint job', 500.00, 'Customization', 8.0, 'Active'),
('Performance Upgrade', 'Engine performance enhancement', 300.00, 'Performance', 4.0, 'Active'),
('Safety Inspection', 'Complete motorcycle safety inspection', 35.00, 'Inspection', 1.0, 'Active');

-- Insert sample service images
INSERT INTO service_images (service_id, image_url, image_name, is_primary, sort_order) VALUES 
(1, '/uploads/services/oil-change-1.jpg', 'Oil Change Service', TRUE, 1),
(1, '/uploads/services/oil-change-2.jpg', 'Oil Change Tools', FALSE, 2),
(2, '/uploads/services/tire-replacement-1.jpg', 'Tire Replacement', TRUE, 1),
(3, '/uploads/services/brake-service-1.jpg', 'Brake Service', TRUE, 1),
(4, '/uploads/services/engine-tuneup-1.jpg', 'Engine Tune-up', TRUE, 1),
(5, '/uploads/services/chain-lubrication-1.jpg', 'Chain Lubrication', TRUE, 1);

-- Create views for common queries
CREATE VIEW active_products AS
SELECT * FROM products WHERE deleted_at IS NULL;

CREATE VIEW active_services AS
SELECT * FROM services WHERE status = 'Active';

CREATE VIEW transaction_summary AS
SELECT 
    t.id,
    t.transaction_date,
    u.full_name as customer_name,
    u.email as customer_email,
    p.name as product_name,
    s.name as service_name,
    t.quantity,
    t.total_amount,
    t.payment_status
FROM transactions t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN products p ON t.product_id = p.id
LEFT JOIN services s ON t.service_id = s.id
ORDER BY t.transaction_date DESC;

-- Create stored procedures
DELIMITER //

-- Procedure to get user transactions
CREATE PROCEDURE GetUserTransactions(IN user_id_param INT)
BEGIN
    SELECT 
        t.*,
        p.name as product_name,
        p.image as product_image,
        s.name as service_name
    FROM transactions t
    LEFT JOIN products p ON t.product_id = p.id
    LEFT JOIN services s ON t.service_id = s.id
    WHERE t.user_id = user_id_param
    ORDER BY t.transaction_date DESC;
END //

-- Procedure to get service with images
CREATE PROCEDURE GetServiceWithImages(IN service_id_param INT)
BEGIN
    SELECT 
        s.*,
        GROUP_CONCAT(si.image_url ORDER BY si.sort_order) as images
    FROM services s
    LEFT JOIN service_images si ON s.id = si.service_id
    WHERE s.id = service_id_param
    GROUP BY s.id;
END //

-- Procedure to update product stock (if needed in future)
CREATE PROCEDURE UpdateProductStock(IN product_id_param INT, IN quantity_param INT)
BEGIN
    -- This can be extended when stock management is added
    UPDATE products 
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = product_id_param;
END //

DELIMITER ;

-- Create triggers for audit trail
CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_table_name (table_name),
    INDEX idx_record_id (record_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- Trigger for users table
DELIMITER //
CREATE TRIGGER users_audit_trigger
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
    VALUES ('users', NEW.id, 'UPDATE', 
            JSON_OBJECT('full_name', OLD.full_name, 'email', OLD.email, 'role', OLD.role),
            JSON_OBJECT('full_name', NEW.full_name, 'email', NEW.email, 'role', NEW.role));
END //

-- Trigger for transactions table
CREATE TRIGGER transactions_audit_trigger
AFTER INSERT ON transactions
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, new_values)
    VALUES ('transactions', NEW.id, 'INSERT', 
            JSON_OBJECT('user_id', NEW.user_id, 'total_amount', NEW.total_amount, 'payment_status', NEW.payment_status));
END //

DELIMITER ;

-- Insert sample data for testing
INSERT INTO users (full_name, email, dealership_name, password_hash, verified, role) VALUES 
('John Doe', 'john@example.com', 'Doe Motors', '$2a$10$samplepasswordhash', TRUE, 'user'),
('Jane Smith', 'jane@example.com', 'Smith Cycles', '$2a$10$samplepasswordhash', TRUE, 'user'),
('Bob Wilson', 'bob@example.com', 'Wilson Bikes', '$2a$10$samplepasswordhash', FALSE, 'user');

-- Insert sample transactions
INSERT INTO transactions (user_id, product_id, quantity, total_amount, payment_method, payment_status, shipping_address) VALUES 
(2, 1, 1, 299.99, 'Credit Card', 'Completed', '123 Main St, City, State 12345'),
(2, 3, 2, 99.98, 'PayPal', 'Completed', '123 Main St, City, State 12345'),
(3, 2, 1, 199.99, 'Credit Card', 'Pending', '456 Oak Ave, City, State 12345'),
(2, NULL, 1, 45.00, 'Cash', 'Completed', '123 Main St, City, State 12345'),
(3, NULL, 1, 120.00, 'Credit Card', 'Completed', '456 Oak Ave, City, State 12345');

-- Show database structure
SHOW TABLES;

-- Show table structures
DESCRIBE users;
DESCRIBE products;
DESCRIBE services;
DESCRIBE service_images;
DESCRIBE transactions;
DESCRIBE audit_log;

-- Show sample data
SELECT 'Users:' as Table_Name;
SELECT id, full_name, email, role, verified FROM users LIMIT 5;

SELECT 'Products:' as Table_Name;
SELECT id, name, price, category, condition FROM products LIMIT 5;

SELECT 'Services:' as Table_Name;
SELECT id, name, price, category, status FROM services LIMIT 5;

SELECT 'Transactions:' as Table_Name;
SELECT id, user_id, product_id, service_id, total_amount, payment_status FROM transactions LIMIT 5; 