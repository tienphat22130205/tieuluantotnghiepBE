const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const { MESSAGES, HTTP_STATUS, ROLE_HIERARCHY } = require('../constants');

const authenticate = (req, res, next) => {
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
