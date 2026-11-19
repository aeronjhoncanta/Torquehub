-- Create motorcycle parts categories table
CREATE TABLE `motorcycle_parts_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `color` varchar(7) DEFAULT '#B399D4',
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert default motorcycle parts categories
INSERT INTO `motorcycle_parts_categories` (`name`, `description`, `icon`, `color`, `sort_order`) VALUES
('Engine Parts', 'Engine components and accessories', 'fas fa-cog', '#FF6B6B', 1),
('Brake System', 'Brake pads, rotors, and brake components', 'fas fa-stop-circle', '#4ECDC4', 2),
('Suspension', 'Shocks, springs, and suspension components', 'fas fa-compress-alt', '#45B7D1', 3),
('Electrical', 'Batteries, lights, and electrical components', 'fas fa-bolt', '#96CEB4', 4),
('Exhaust System', 'Mufflers, headers, and exhaust components', 'fas fa-wind', '#FFEAA7', 5),
('Tires & Wheels', 'Tires, rims, and wheel components', 'fas fa-circle', '#DDA0DD', 6),
('Body & Fairings', 'Body panels, fairings, and cosmetic parts', 'fas fa-shield-alt', '#98D8C8', 7),
('Accessories', 'Aftermarket accessories and add-ons', 'fas fa-star', '#F7DC6F', 8),
('Oil & Fluids', 'Engine oil, brake fluid, and lubricants', 'fas fa-tint', '#BB8FCE', 9),
('Tools & Maintenance', 'Tools and maintenance equipment', 'fas fa-wrench', '#85C1E9', 10),
('Safety Gear', 'Helmets, jackets, and safety equipment', 'fas fa-hard-hat', '#F8C471', 11),
('Performance Parts', 'High-performance upgrades and modifications', 'fas fa-tachometer-alt', '#A9CCE3', 12);

-- Add parts_category_id column to products table
ALTER TABLE `products` ADD COLUMN `parts_category_id` int(11) DEFAULT NULL AFTER `category_id`;

-- Add foreign key constraint for parts categories
ALTER TABLE `products` 
ADD CONSTRAINT `fk_products_parts_category` 
FOREIGN KEY (`parts_category_id`) REFERENCES `motorcycle_parts_categories`(`id`) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Update existing parts products to use proper categories
UPDATE `products` SET `parts_category_id` = 1 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%engine%';
UPDATE `products` SET `parts_category_id` = 2 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%brake%';
UPDATE `products` SET `parts_category_id` = 3 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%suspension%';
UPDATE `products` SET `parts_category_id` = 4 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%electrical%';
UPDATE `products` SET `parts_category_id` = 5 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%exhaust%';
UPDATE `products` SET `parts_category_id` = 6 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%tire%';
UPDATE `products` SET `parts_category_id` = 7 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%body%';
UPDATE `products` SET `parts_category_id` = 8 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%accessory%';
UPDATE `products` SET `parts_category_id` = 9 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%oil%';
UPDATE `products` SET `parts_category_id` = 10 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%tool%';
UPDATE `products` SET `parts_category_id` = 11 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%safety%';
UPDATE `products` SET `parts_category_id` = 12 WHERE `category` = 'Motorcycle Parts' AND `name` LIKE '%performance%';

-- Set default category for remaining parts products
UPDATE `products` SET `parts_category_id` = 8 WHERE `category` = 'Motorcycle Parts' AND `parts_category_id` IS NULL; 