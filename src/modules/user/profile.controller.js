const ProfileService = require('./profile.service');
const { sendSuccess, sendError } = require('../../utils/response');

class ProfileController {
  static async getMyProfile(req, res) {
    try {
      const result = await ProfileService.getProfileByUserId(req.user.id);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Get my profile controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getProfileById(req, res) {
    try {
      const result = await ProfileService.getProfileByUserId(req.params.userId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Get profile by id controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async updateMyProfile(req, res) {
    try {
      const result = await ProfileService.updateMyProfile(req.user.id, req.body || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, 'Cập nhật profile thành công', result.data);
    } catch (error) {
      console.error('Update profile controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async updateMyAvatar(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'Vui lòng chọn ảnh avatar');
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const result = await ProfileService.updateMyAvatar(req.user.id, avatarUrl, req.body || {});

      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, 'Cập nhật avatar thành công', result.data);
    } catch (error) {
      console.error('Update avatar controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = ProfileController;
