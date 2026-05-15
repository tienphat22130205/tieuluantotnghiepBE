const AuthService = require('./auth.service');
const { sendSuccess, sendError } = require('../../utils/response');

class AuthController {
  // Register
  static async register(req, res) {
    try {
      const {
        email,
        phone,
        dateOfBirth,
        password,
        confirmPassword,
        firstName,
        lastName,
        location,
      } = req.body;

      const result = await AuthService.register({
        email,
        phone,
        dateOfBirth,
        password,
        confirmPassword,
        firstName,
        lastName,
        location,
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

  // Set username after email verification
  static async setUsername(req, res) {
    try {
      const userId = req.user.id;
      const { username } = req.body;

      const result = await AuthService.setUsername(userId, username);

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Set username controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Suggest username based on firstName and lastName
  static async suggestUsername(req, res) {
    try {
      const userId = req.user.id;

      const result = await AuthService.suggestUsername(userId);

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Suggest username controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
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

  static async getAdminUserList(req, res) {
    try {
      const result = await AuthService.getAdminUserList(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get admin user list controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async banUser(req, res) {
    try {
      const { userId } = req.params;
      const adminUserId = req.user.id;

      const result = await AuthService.banUser(userId, adminUserId, req.body || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Ban user controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async unbanUser(req, res) {
    try {
      const { userId } = req.params;
      const adminUserId = req.user.id;

      const result = await AuthService.unbanUser(userId, adminUserId);

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Unban user controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async createUnbanRequest(req, res) {
    try {
      const result = await AuthService.createUnbanRequest(req.body || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Create unban request controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getMyUnbanRequestHistory(req, res) {
    try {
      const result = await AuthService.getMyUnbanRequestHistory(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get my unban request history controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getUnbanRequests(req, res) {
    try {
      const result = await AuthService.getUnbanRequests(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get unban requests controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async reviewUnbanRequest(req, res) {
    try {
      const result = await AuthService.reviewUnbanRequest(req.params.requestId, req.user.id, req.body || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Review unban request controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Check user role and return redirect URL
  static async getRoleRedirection(req, res) {
    try {
      const result = await AuthService.getRoleRedirection(req.user);

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get role redirection controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = AuthController;
