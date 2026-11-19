const { Notification, User } = require('../models');
const EmailService = require('./emailService');

class NotificationService {
  // Create a notification for a user
  async createNotification(userId, title, message, type = 'transaction', data = null) {
    try {
      const notification = await Notification.create({
        user_id: userId,
        title,
        message,
        type,
        data,
        status: 'unread'
      });

      console.log(`Notification created for user ${userId}: ${title}`);
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Create transaction status change notification
  async createTransactionStatusNotification(transaction, user, product, previousStatus = null) {
    try {
      console.log('🔔 Creating transaction status notification for transaction:', transaction.id);
      console.log('👤 User:', user.id, user.full_name);
      console.log('📦 Product:', product.name);
      console.log('📊 Status change:', previousStatus, '→', transaction.status);
      
      const statusChange = previousStatus ? ` from ${previousStatus} to ${transaction.status}` : ` to ${transaction.status}`;
      
      const title = `Order Status Updated - Order #${transaction.id}`;
      const message = `Your order status has been updated${statusChange}. Your order is now ${transaction.status}. Total amount: $${parseFloat(transaction.total_amount).toFixed(2)}`;
      
      const notificationData = {
        transaction_id: transaction.id,
        previous_status: previousStatus,
        new_status: transaction.status,
        product_name: product.name,
        total_amount: parseFloat(transaction.total_amount).toFixed(2)
      };

      const notification = await this.createNotification(
        user.id,
        title,
        message,
        'transaction',
        notificationData
      );

      console.log('✅ Transaction notification created:', notification.id);

      // Send email notification
      try {
        await EmailService.sendTransactionStatusUpdateEmail(transaction, user, product, previousStatus);
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        // Don't throw error, notification is still created
      }

      return notification;
    } catch (error) {
      console.error('❌ Error creating transaction status notification:', error);
      throw error;
    }
  }

  // Get user's notifications
  async getUserNotifications(userId, limit = 50, offset = 0) {
    try {
      console.log('🔍 Fetching notifications for user:', userId);
      
      const notifications = await Notification.findAll({
        where: { user_id: userId },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      console.log('✅ Found notifications:', notifications.length);
      return notifications;
    } catch (error) {
      console.error('❌ Error fetching user notifications:', error);
      throw error;
    }
  }

  // Get unread notifications count
  async getUnreadCount(userId) {
    try {
      const count = await Notification.count({
        where: { 
          user_id: userId,
          status: 'unread'
        }
      });

      return count;
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { 
          id: notificationId,
          user_id: userId
        }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.update({
        status: 'read',
        read_at: new Date()
      });

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    try {
      await Notification.update(
        {
          status: 'read',
          read_at: new Date()
        },
        {
          where: { 
            user_id: userId,
            status: 'unread'
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { 
          id: notificationId,
          user_id: userId
        }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.destroy();
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Create bulk notifications
  async createBulkNotifications(userIds, title, message, type = 'system', data = null) {
    try {
      const notifications = [];
      
      for (const userId of userIds) {
        const notification = await this.createNotification(userId, title, message, type, data);
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  // Get notification statistics (admin only)
  async getNotificationStats() {
    try {
      const totalNotifications = await Notification.count();
      const unreadNotifications = await Notification.count({ where: { status: 'unread' } });
      const todayNotifications = await Notification.count({
        where: {
          createdAt: {
            [require('sequelize').Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });

      return {
        total: totalNotifications,
        unread: unreadNotifications,
        today: todayNotifications
      };
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService(); 