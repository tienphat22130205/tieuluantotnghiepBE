const mongoose = require('mongoose');
const AdminNotification = require('./admin-notification.model');

class AdminNotificationService {
  static async listNotifications({ page = 1, limit = 20, type = 'all', unreadOnly = false } = {}) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const filter = {};
      if (type && type !== 'all') {
        filter.type = type;
      }
      if (unreadOnly === true || unreadOnly === 'true') {
        filter.isRead = false;
      }

      const [items, totalItems, unreadCount] = await Promise.all([
        AdminNotification.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        AdminNotification.countDocuments(filter),
        AdminNotification.countDocuments({ isRead: false }),
      ]);

      const totalPages = Math.ceil(totalItems / limitNum) || 1;

      return {
        success: true,
        data: {
          items,
          unreadCount,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalItems,
            totalPages,
          },
        },
      };
    } catch (error) {
      console.error('AdminNotificationService.listNotifications error:', error);
      return {
        success: false,
        message: 'Lỗi tải danh sách thông báo quản trị',
        error: error.message,
      };
    }
  }

  static async getUnreadCount() {
    try {
      const unreadCount = await AdminNotification.countDocuments({ isRead: false });
      return {
        success: true,
        data: { unreadCount },
      };
    } catch (error) {
      console.error('AdminNotificationService.getUnreadCount error:', error);
      return {
        success: false,
        message: 'Lỗi lấy số lượng thông báo chưa đọc',
        data: { unreadCount: 0 },
      };
    }
  }

  static async markAsRead(notificationId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return { success: false, message: 'ID thông báo không hợp lệ' };
      }

      const updated = await AdminNotification.findByIdAndUpdate(
        notificationId,
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        },
        { new: true }
      );

      const unreadCount = await AdminNotification.countDocuments({ isRead: false });

      return {
        success: true,
        data: {
          notification: updated,
          unreadCount,
        },
      };
    } catch (error) {
      console.error('AdminNotificationService.markAsRead error:', error);
      return { success: false, message: 'Lỗi đánh dấu đã đọc' };
    }
  }

  static async markAllAsRead() {
    try {
      await AdminNotification.updateMany(
        { isRead: false },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

      return {
        success: true,
        data: { unreadCount: 0 },
      };
    } catch (error) {
      console.error('AdminNotificationService.markAllAsRead error:', error);
      return { success: false, message: 'Lỗi đánh dấu tất cả đã đọc' };
    }
  }

  static async deleteNotification(notificationId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return { success: false, message: 'ID thông báo không hợp lệ' };
      }

      await AdminNotification.findByIdAndDelete(notificationId);
      const unreadCount = await AdminNotification.countDocuments({ isRead: false });

      return {
        success: true,
        data: { unreadCount },
      };
    } catch (error) {
      console.error('AdminNotificationService.deleteNotification error:', error);
      return { success: false, message: 'Lỗi xóa thông báo' };
    }
  }

  static async clearAllNotifications() {
    try {
      await AdminNotification.deleteMany({});
      return {
        success: true,
        data: { unreadCount: 0 },
      };
    } catch (error) {
      console.error('AdminNotificationService.clearAllNotifications error:', error);
      return { success: false, message: 'Lỗi xóa tất cả thông báo' };
    }
  }
}

module.exports = AdminNotificationService;

