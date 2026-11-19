const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');
const { User } = require('../models');

// Get user's notifications
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    console.log('🔔 Notification API called for user:', req.user.id);
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    
    console.log('📋 Request params:', { limit, offset });
    
    const notifications = await NotificationService.getUserNotifications(userId, parseInt(limit), parseInt(offset));
    
    console.log('📤 Sending notifications response:', notifications.length);
    
    res.json({
      success: true,
      notifications: notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        status: notification.status,
        data: notification.data,
        read_at: notification.read_at,
        createdAt: notification.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch notifications' 
    });
  }
});

// Get unread notifications count
router.get('/unread-count', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await NotificationService.getUnreadCount(userId);
    
    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch unread count' 
    });
  }
});

// Mark notification as read
router.put('/:id/read', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    await NotificationService.markAsRead(notificationId, userId);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as read' 
    });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await NotificationService.markAllAsRead(userId);
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark all notifications as read' 
    });
  }
});

// Delete notification
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    await NotificationService.deleteNotification(notificationId, userId);
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete notification' 
    });
  }
});

// Create notification (admin only)
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { userId, title, message, type = 'system', data = null } = req.body;
    
    // Check if user is admin
    if (req.user.role_id !== 2) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }
    
    const notification = await NotificationService.createNotification(userId, title, message, type, data);
    
    res.json({
      success: true,
      notification: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        status: notification.status,
        data: notification.data,
        createdAt: notification.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create notification' 
    });
  }
});

module.exports = router; 