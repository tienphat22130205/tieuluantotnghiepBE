const AuthService = require('./auth.service');
const { sendSuccess, sendError } = require('../../utils/response');

class AuthController {
  // Register
  static async register(req, res) {
    try {
      const { username, email, phone, password, confirmPassword } = req.body;

      const result = await AuthService.register({
        username,
        email,
        phone,
        password,
        confirmPassword,
      });

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      } else {
        return sendError(res, result.statusCode, result.message, result.error);
      }
    } catch (error) {
      console.error('Register controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Login
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login({
        email,
        password,
      });

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      } else {
        return sendError(res, result.statusCode, result.message, result.error);
      }
    } catch (error) {
      console.error('Login controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Get current user
  static async getCurrentUser(req, res) {
    try {
      const userId = req.user.id;

      const result = await AuthService.getUserById(userId);

      if (result.success) {
        return sendSuccess(res, result.statusCode, 'Lấy thông tin người dùng thành công', result.data);
      } else {
        return sendError(res, result.statusCode, result.message, result.error);
      }
    } catch (error) {
      console.error('Get current user error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Logout
  static logout(req, res) {
    try {
      // In a stateless JWT setup, logout is handled on the client side
      // Client will remove the token from local storage
      return sendSuccess(res, 200, 'Đăng xuất thành công');
    } catch (error) {
      console.error('Logout error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Verify email
  static async verifyEmail(req, res) {
    try {
      const { token } = req.query;

      const result = await AuthService.verifyEmail(token);

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      } else {
        return sendError(res, result.statusCode, result.message, result.error);
      }
    } catch (error) {
      console.error('Verify email controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Moderator+ endpoint sample
  static getModeratorDashboard(req, res) {
    return sendSuccess(res, 200, 'Truy cập khu vực moderator thành công', {
      role: req.user.role,
      userId: req.user.id,
    });
  }

  // Admin endpoint sample
  static getAdminDashboard(req, res) {
    return sendSuccess(res, 200, 'Truy cập khu vực admin thành công', {
      role: req.user.role,
      userId: req.user.id,
    });
  }

  // Admin updates user role
  static async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      const result = await AuthService.updateUserRole(userId, role);

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Update user role controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = AuthController;
