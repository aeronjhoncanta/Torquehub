-- Create notifications table for TorqueHub
-- Based on existing database schema from torquehubmotor.sql
-- Run this script in your MySQL database (phpMyAdmin or MySQL command line)

USE torquehubmotor;

-- Create notifications table matching existing schema conventions
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` enum('transaction','system','order','payment') DEFAULT 'transaction',
  `status` enum('unread','read') DEFAULT 'unread',
  `data` json DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`),
  KEY `createdAt` (`createdAt`),
  KEY `user_status` (`user_id`, `status`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert sample notifications for testing
INSERT INTO `notifications` (`user_id`, `title`, `message`, `type`, `status`, `createdAt`, `updatedAt`) VALUES
(9, 'Welcome to TorqueHub!', 'Thank you for joining our motorcycle community.', 'system', 'unread', NOW(), NOW()),
(9, 'Order Status Updated - Order #4', 'Your order status has been updated to shipped. Your order has been shipped and is on its way to you.', 'transaction', 'unread', NOW(), NOW()),
(9, 'Promo: 10% off on all parts!', 'Get 10% off on all motorcycle parts this week only.', 'system', 'unread', NOW(), NOW()),
(8, 'Welcome to TorqueHub!', 'Thank you for joining our motorcycle community.', 'system', 'unread', NOW(), NOW()),
(8, 'Order Status Updated - Order #3', 'Your order status has been updated to pending. Your order is being reviewed by our team.', 'transaction', 'unread', NOW(), NOW());

-- Verify the table was created
SELECT 'Notifications table created successfully!' as status;
SELECT COUNT(*) as notification_count FROM notifications; 