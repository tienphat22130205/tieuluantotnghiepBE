const UserService = require('./user.service');
const { sendSuccess, sendError } = require('../../utils/response');

class UserController {
  static async searchUsers(req, res) {
    try {
      const result = await UserService.searchUsers(req.user.id, req.query || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getUserPresence(req, res) {
    try {
      const result = await UserService.getUserPresence(req.user.id, req.params.userId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getUsersPresence(req, res) {
    try {
      const result = await UserService.getUsersPresence(req.user.id, req.query || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = UserController;
