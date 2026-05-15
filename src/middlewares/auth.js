const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const { MESSAGES, HTTP_STATUS, ROLE_HIERARCHY } = require('../constants');
const User = require('../modules/auth/auth.model');

const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.TOKEN_REQUIRED);
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.INVALID_TOKEN);
    }

    const user = await User.findById(decoded.id).select('isBanned banReason banUntil isActive');
    if (!user) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.INVALID_TOKEN);
    }

    if (user.isBanned && user.banUntil && user.banUntil <= new Date()) {
      user.isBanned = false;
      user.isActive = true;
      user.banUntil = null;
      user.unbannedAt = new Date();
      user.unbannedBy = null;
      await user.save();
    }

    if (user.isBanned) {
      const message = user.banUntil
        ? `Tài khoản đã bị khóa đến ${new Date(user.banUntil).toLocaleString('vi-VN')}`
        : 'Tài khoản đã bị khóa';

      return sendError(res, HTTP_STATUS.FORBIDDEN, message, {
        code: 'ACCOUNT_BANNED',
        reason: user.banReason || 'Vi phạm chính sách cộng đồng',
        banUntil: user.banUntil || null,
        isPermanent: !user.banUntil,
        forceLogout: true,
      });
    }

    if (!user.isActive) {
      return sendError(res, HTTP_STATUS.FORBIDDEN, 'Tài khoản đã bị vô hiệu hóa', {
        code: 'ACCOUNT_DISABLED',
        forceLogout: true,
      });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return sendError(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.INVALID_TOKEN);
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return sendError(res, HTTP_STATUS.FORBIDDEN, 'Không có quyền truy cập');
      }

      const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;
      const requiredRoleLevel = Math.min(...allowedRoles.map((role) => ROLE_HIERARCHY[role] || 0));

      if (userRoleLevel < requiredRoleLevel) {
        return sendError(res, HTTP_STATUS.FORBIDDEN, 'Bạn không có quyền thực hiện thao tác này');
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return sendError(res, HTTP_STATUS.FORBIDDEN, 'Không có quyền truy cập');
    }
  };
};

module.exports = {
  authenticate,
  authorize,
};
