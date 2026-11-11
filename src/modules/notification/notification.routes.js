const express = require('express');
const NotificationController = require('./notification.controller');
const AdminNotificationController = require('./admin-notification.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const { ROLES } = require('../../constants');

const router = express.Router();

router.use(authenticate);

// Admin-specific notification endpoints (Must be declared before parameterized routes)
router.get('/admin', authorize(ROLES.ADMIN, ROLES.MODERATOR), AdminNotificationController.getAdminNotifications);
router.get('/admin/unread-count', authorize(ROLES.ADMIN, ROLES.MODERATOR), AdminNotificationController.getAdminUnreadCount);
router.patch('/admin/read-all', authorize(ROLES.ADMIN, ROLES.MODERATOR), AdminNotificationController.markAllAdminAsRead);
router.delete('/admin/clear-all', authorize(ROLES.ADMIN, ROLES.MODERATOR), AdminNotificationController.clearAllAdminNotifications);
router.patch('/admin/:notificationId/read', authorize(ROLES.ADMIN, ROLES.MODERATOR), AdminNotificationController.markAdminAsRead);
router.delete('/admin/:notificationId', authorize(ROLES.ADMIN, ROLES.MODERATOR), AdminNotificationController.deleteAdminNotification);

// User notification endpoints
router.get('/', NotificationController.getMyNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/read-all', NotificationController.markAllAsRead);
router.delete('/', NotificationController.deleteAllNotifications);
router.patch('/:notificationId/read', NotificationController.markAsRead);
router.delete('/:notificationId', NotificationController.deleteNotification);

module.exports = router;
