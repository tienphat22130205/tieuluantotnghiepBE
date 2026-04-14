const express = require('express');
const NotificationController = require('./notification.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', NotificationController.getMyNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/read-all', NotificationController.markAllAsRead);
router.delete('/', NotificationController.deleteAllNotifications);
router.patch('/:notificationId/read', NotificationController.markAsRead);
router.delete('/:notificationId', NotificationController.deleteNotification);

module.exports = router;
