const AdminNotificationService = require('./admin-notification.service');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS } = require('../../constants');

class AdminNotificationController {
  static async getAdminNotifications(req, res) {
    try {
      const result = await AdminNotificationService.listNotifications(req.query);
      if (!result.success) {
        return sendError(res, HTTP_STATUS.BAD_REQUEST, result.message);
      }
      return sendSuccess(res, HTTP_STATUS.OK, 'Lấy danh sách thông báo quản trị thành công', result.data);
    } catch (error) {
      console.error('getAdminNotifications error:', error);
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Lỗi hệ thống');
    }
  }

  static async getAdminUnreadCount(req, res) {
    try {
      const result = await AdminNotificationService.getUnreadCount();
      return sendSuccess(res, HTTP_STATUS.OK, 'Lấy số lượng chưa đọc thành công', result.data);
    } catch (error) {
      console.error('getAdminUnreadCount error:', error);
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Lỗi hệ thống');
    }
  }

  static async markAdminAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const result = await AdminNotificationService.markAsRead(notificationId);
      if (!result.success) {
        return sendError(res, HTTP_STATUS.BAD_REQUEST, result.message);
      }
      return sendSuccess(res, HTTP_STATUS.OK, 'Đánh dấu đã đọc thành công', result.data);
    } catch (error) {
      console.error('markAdminAsRead error:', error);
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Lỗi hệ thống');
    }
  }

  static async markAllAdminAsRead(req, res) {
    try {
      const result = await AdminNotificationService.markAllAsRead();
      if (!result.success) {
        return sendError(res, HTTP_STATUS.BAD_REQUEST, result.message);
      }
      return sendSuccess(res, HTTP_STATUS.OK, 'Đánh dấu tất cả đã đọc thành công', result.data);
    } catch (error) {
      console.error('markAllAdminAsRead error:', error);
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Lỗi hệ thống');
    }
  }

  static async deleteAdminNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const result = await AdminNotificationService.deleteNotification(notificationId);
      if (!result.success) {
        return sendError(res, HTTP_STATUS.BAD_REQUEST, result.message);
      }
      return sendSuccess(res, HTTP_STATUS.OK, 'Xóa thông báo thành công', result.data);
    } catch (error) {
      console.error('deleteAdminNotification error:', error);
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Lỗi hệ thống');
    }
  }

  static async clearAllAdminNotifications(req, res) {
    try {
      const result = await AdminNotificationService.clearAllNotifications();
      if (!result.success) {
        return sendError(res, HTTP_STATUS.BAD_REQUEST, result.message);
      }
      return sendSuccess(res, HTTP_STATUS.OK, 'Xóa toàn bộ thông báo thành công', result.data);
    } catch (error) {
      console.error('clearAllAdminNotifications error:', error);
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Lỗi hệ thống');
    }
  }
}

module.exports = AdminNotificationController;

