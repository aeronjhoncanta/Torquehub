class NotificationManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.notificationDropdown = document.querySelector('.notif-dropdown-panel');
        this.notificationBadge = document.querySelector('.notif-badge');
        this.notificationBtn = document.querySelector('.notification-btn');
        
        this.init();
    }

    async init() {
        try {
            await this.loadNotifications();
            await this.loadUnreadCount();
            this.setupEventListeners();
            this.startPolling();
        } catch (error) {
            console.error('Failed to initialize notifications:', error);
        }
    }

    async loadNotifications() {
        try {
            // Show loading state
            this.showLoadingState();

            const response = await fetch('/api/notifications?limit=10', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📡 API Response:', data);
            if (data.success) {
                this.notifications = data.notifications;
                console.log('📋 Loaded notifications:', this.notifications);
                this.renderNotifications();
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showErrorState();
        }
    }

    showLoadingState() {
        const container = this.notificationDropdown?.querySelector('.notif-items-container');
        if (container) {
            container.innerHTML = '<li class="notif-item"><span style="color: #888; font-style: italic;">Loading notifications...</span></li>';
        }
    }

    showErrorState() {
        const container = this.notificationDropdown?.querySelector('.notif-items-container');
        if (container) {
            container.innerHTML = '<li class="notif-item"><span style="color: #e74c3c; font-style: italic;">Failed to load notifications</span></li>';
        }
    }

    async loadUnreadCount() {
        try {
            const response = await fetch('/api/notifications/unread-count', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                this.unreadCount = data.count;
                this.updateBadge();
            }
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    }

    renderNotifications() {
        if (!this.notificationDropdown) return;

        // Find the container for notification items
        const container = this.notificationDropdown.querySelector('.notif-items-container');
        if (!container) return;

        // Clear existing notifications
        container.innerHTML = '';

        // Add notifications
        this.notifications.forEach(notification => {
            const notificationItem = this.createNotificationItem(notification);
            container.appendChild(notificationItem);
        });

        // Show "no notifications" message if empty
        if (this.notifications.length === 0) {
            const noNotificationsItem = document.createElement('li');
            noNotificationsItem.className = 'notif-item';
            noNotificationsItem.innerHTML = '<span style="color: #888; font-style: italic;">No notifications</span>';
            container.appendChild(noNotificationsItem);
        }
    }

    createNotificationItem(notification) {
        const item = document.createElement('li');
        item.className = `notif-item ${notification.status === 'unread' ? 'unread' : ''}`;
        item.dataset.notificationId = notification.id;

        const icon = this.getNotificationIcon(notification.type);
        const timeAgo = this.getTimeAgo(notification.createdAt);

        // Debug: Log the notification data
        console.log('🔍 Creating notification item:', {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type
        });
        
        item.innerHTML = `
            <i class="${icon}"></i>
            <div class="notif-content">
                <div class="notif-title">${notification.title}</div>
                <div class="notif-message">${notification.message}</div>
            </div>
            <span class="notif-time">${timeAgo}</span>
        `;

        // Add click handler to mark as read
        item.addEventListener('click', () => this.markAsRead(notification.id));

        return item;
    }

    getNotificationIcon(type) {
        const icons = {
            'transaction': 'fas fa-shopping-cart',
            'system': 'fas fa-info-circle',
            'order': 'fas fa-box',
            'payment': 'fas fa-credit-card',
            'default': 'fas fa-bell'
        };
        return icons[type] || icons.default;
    }

    getTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) {
            return `${diffInSeconds}s ago`;
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes}m ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days}d ago`;
        }
    }

    updateBadge() {
        if (this.notificationBadge) {
            if (this.unreadCount > 0) {
                this.notificationBadge.textContent = this.unreadCount;
                this.notificationBadge.style.display = 'block';
            } else {
                this.notificationBadge.style.display = 'none';
            }
        }
    }

    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Update local state
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.status = 'read';
                notification.read_at = new Date().toISOString();
            }

            // Reload unread count and re-render
            await this.loadUnreadCount();
            this.renderNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Update local state
            this.notifications.forEach(notification => {
                notification.status = 'read';
                notification.read_at = new Date().toISOString();
            });

            // Reload unread count and re-render
            await this.loadUnreadCount();
            this.renderNotifications();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    setupEventListeners() {
        // Toggle notification dropdown
        if (this.notificationBtn) {
            this.notificationBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleDropdown();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.notificationBtn?.contains(e.target) && !this.notificationDropdown?.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Add "Mark all as read" functionality
        const notifHeader = this.notificationDropdown?.querySelector('.notif-header');
        if (notifHeader) {
            notifHeader.style.cursor = 'pointer';
            notifHeader.addEventListener('click', () => this.markAllAsRead());
        }
    }

    toggleDropdown() {
        if (this.notificationDropdown) {
            const isVisible = this.notificationDropdown.style.display === 'block';
            if (isVisible) {
                this.closeDropdown();
            } else {
                this.openDropdown();
            }
        }
    }

    openDropdown() {
        if (this.notificationDropdown) {
            this.notificationDropdown.style.display = 'block';
        }
    }

    closeDropdown() {
        if (this.notificationDropdown) {
            this.notificationDropdown.style.display = 'none';
        }
    }

    startPolling() {
        // Poll for new notifications every 30 seconds
        setInterval(async () => {
            await this.loadUnreadCount();
        }, 30000);
    }


}

// Initialize notification manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager = new NotificationManager();
}); 