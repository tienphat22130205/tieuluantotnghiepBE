const mongoose = require('mongoose');
const Notification = require('./notification.model');
const { HTTP_STATUS } = require('../../constants');
const { emitToUser } = require('../../realtime/socket');

class NotificationService {
  static async emitUnreadCount(recipient) {
    const unreadCount = await Notification.countDocuments({
      recipient,
      isRead: false,
      isDeleted: { $ne: true },
    });

    emitToUser(recipient, 'notification:unread-count', {
      unreadCount,
    });
  }

  static async createNotification(payload = {}) {
    const recipient = payload.recipient?.toString();
    const actor = payload.actor?.toString();

    if (!recipient || !actor || recipient === actor) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      actor,
      type: payload.type,
      post: payload.post || null,
      postModel: payload.postModel || 'Post',
      friendRequest: payload.friendRequest || null,
      message: payload.message || '',
      metadata: payload.metadata || {},
    });

    emitToUser(recipient, 'notification:new', {
      notification,
    });

    await this.emitUnreadCount(recipient);

    return notification;
  }

  static async getMyNotifications(userId, query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const filter = { recipient: userId, isDeleted: { $ne: true } };
    if (query.unread === 'true') {
      filter.isRead = false;
    }

    const [total, items] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .populate('actor', 'username firstName lastName avatar')
        .populate({
          path: 'post',
          select: 'content images postType',
          match: { isDeleted: { $ne: true } },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách thông báo thành công',
      data: {
        items,
        meta: {
          page,
          limit,
          total,
          hasMore: page * limit < total,
        },
      },
    };
  }

  static async getUnreadCount(userId) {
    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: { $ne: true },
    });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy số thông báo chưa đọc thành công',
      data: { unreadCount: count },
    };
  }

  static async markAsRead(userId, notificationId) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Notification ID không hợp lệ',
      };
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId, isDeleted: { $ne: true } },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy thông báo',
      };
    }

    await this.emitUnreadCount(userId);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Đánh dấu đã đọc thành công',
      data: notification,
    };
  }

  static async markAllAsRead(userId) {
    await Notification.updateMany(
      { recipient: userId, isRead: false, isDeleted: { $ne: true } },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    await this.emitUnreadCount(userId);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
    };
  }

  static async deleteNotification(userId, notificationId) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Notification ID không hợp lệ',
      };
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy thông báo',
      };
    }

    await this.emitUnreadCount(userId);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Xóa thông báo thành công',
      data: {
        deletedNotificationId: notificationId,
      },
    };
  }

  static async deleteAllNotifications(userId) {
    const result = await Notification.updateMany(
      { recipient: userId, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      }
    );

    await this.emitUnreadCount(userId);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Xóa tất cả thông báo thành công',
      data: {
        deletedCount: result.modifiedCount || 0,
      },
    };
  }
}

module.exports = NotificationService;
