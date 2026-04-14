const NotificationService = require('./notification.service');
const { sendSuccess, sendError } = require('../../utils/response');

class NotificationController {
  static async getMyNotifications(req, res) {
    try {
      const result = await NotificationService.getMyNotifications(req.user.id, req.query || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getUnreadCount(req, res) {
    try {
      const result = await NotificationService.getUnreadCount(req.user.id);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async markAsRead(req, res) {
    try {
      const result = await NotificationService.markAsRead(req.user.id, req.params.notificationId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async markAllAsRead(req, res) {
    try {
      const result = await NotificationService.markAllAsRead(req.user.id);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async deleteNotification(req, res) {
    try {
      const result = await NotificationService.deleteNotification(req.user.id, req.params.notificationId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async deleteAllNotifications(req, res) {
    try {
      const result = await NotificationService.deleteAllNotifications(req.user.id);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = NotificationController;
