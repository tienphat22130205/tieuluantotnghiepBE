const firebaseAdmin = require('../config/firebase');
const User = require('../modules/auth/auth.model');
const { sendError } = require('../utils/response');
const { HTTP_STATUS, MESSAGES, ROLES } = require('../constants');

/**
 * 3.2.1 requireAuth:
 * - Kiểm tra header Authorization. Nếu thiếu hoặc sai định dạng Bearer <token>, trả về 401 Unauthorized.
 * - Sử dụng Firebase Admin SDK gọi phương thức verifyIdToken(token) để giải mã và xác thực chữ ký của token JWT.
 * - So sánh UID giải mã được với ID tài nguyên yêu cầu (đối với người dùng thông thường phải trùng khớp, ngoại trừ trường hợp có quyền admin).
 * - Ghi đè header x-user-uid bằng mã UID đã xác thực và gán đối tượng thông tin người dùng vào biến request (req.user).
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Thiếu hoặc sai định dạng header Authorization (Bearer <token>)');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.TOKEN_REQUIRED);
    }

    // Verify Firebase JWT token
    let decodedToken;
    try {
      decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    } catch (err) {
      console.error('Firebase verifyIdToken error:', err.message);
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Token không hợp lệ hoặc đã hết hạn');
    }

    const authenticatedUid = decodedToken.uid;

    // Tìm người dùng trong MongoDB theo firebaseUid hoặc email/id
    const mongoUser = await User.findOne({
      $or: [
        { firebaseUid: authenticatedUid },
        { email: decodedToken.email },
      ],
    }).select('+password');

    // So sánh UID giải mã với ID tài nguyên yêu cầu (nếu có req.params.userId / req.query.userId)
    const requestedResourceId = req.params.userId || req.params.uid || req.query.userId || null;
    const isUserAdmin = mongoUser && mongoUser.role === ROLES.ADMIN;

    if (requestedResourceId && !isUserAdmin && requestedResourceId !== authenticatedUid && mongoUser?._id?.toString() !== requestedResourceId) {
      return sendError(res, HTTP_STATUS.FORBIDDEN, 'Bạn không có quyền truy cập vào tài nguyên của người dùng khác');
    }

    // Ghi đè header x-user-uid bằng mã UID đã xác thực
    req.headers['x-user-uid'] = authenticatedUid;

    // Gán đối tượng thông tin người dùng vào req.user
    req.user = {
      ...decodedToken,
      id: mongoUser?._id?.toString() || authenticatedUid,
      _id: mongoUser?._id || authenticatedUid,
      uid: authenticatedUid,
      firebaseUid: authenticatedUid,
      role: mongoUser?.role || ROLES.USER,
      email: decodedToken.email || mongoUser?.email,
      mongoUser: mongoUser || null,
    };

    next();
  } catch (error) {
    console.error('requireAuth Middleware Error:', error);
    return sendError(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.INVALID_TOKEN);
  }
};

/**
 * 3.2.2 requireAdmin:
 * - Đọc x-user-uid đã được thiết lập từ requireAuth.
 * - Truy vấn cơ sở dữ liệu MongoDB thông qua UserModel.findOne({ firebaseUid }).
 * - Kiểm tra trường vai trò của người dùng (role). Nếu khác 'admin', lập tức trả về 403 Forbidden.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const firebaseUid = req.headers['x-user-uid'];
    if (!firebaseUid) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'Thiếu x-user-uid header từ requireAuth');
    }

    const user = await User.findOne({
      $or: [
        { firebaseUid: firebaseUid },
        { _id: req.user?.id },
        { email: req.user?.email },
      ],
    });

    if (!user) {
      return sendError(res, HTTP_STATUS.NOT_FOUND, 'Không tìm thấy thông tin người dùng trong cơ sở dữ liệu');
    }

    if (user.role !== ROLES.ADMIN && user.role !== 'admin') {
      return sendError(res, HTTP_STATUS.FORBIDDEN, 'Truy cập bị từ chối. Bạn không phải là Quản trị viên (Admin)');
    }

    req.user.mongoUser = user;
    next();
  } catch (error) {
    console.error('requireAdmin Middleware Error:', error);
    return sendError(res, HTTP_STATUS.FORBIDDEN, 'Không có quyền truy cập quản trị');
  }
};

module.exports = {
  requireAuth,
  requireAdmin,
};
