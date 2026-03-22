const MESSAGES = {
  // Auth Messages
  REGISTER_SUCCESS: 'Đăng ký thành công',
  REGISTER_FAILED: 'Đăng ký thất bại',
  EMAIL_ALREADY_EXISTS: 'Email đã được sử dụng',
  USERNAME_ALREADY_EXISTS: 'Tên người dùng đã tồn tại',
  PHONE_ALREADY_EXISTS: 'Số điện thoại đã được sử dụng',

  LOGIN_SUCCESS: 'Đăng nhập thành công',
  LOGIN_FAILED: 'Email hoặc mật khẩu không chính xác',
  INVALID_EMAIL: 'Email không hợp lệ',
  INVALID_PASSWORD: 'Mật khẩu không hợp lệ',
  WEAK_PASSWORD: 'Mật khẩu phải có ít nhất 6 ký tự',
  INVALID_PHONE: 'Số điện thoại không hợp lệ',
  MISSING_FIELDS: 'Vui lòng điền đầy đủ thông tin',

  // Token Messages
  INVALID_TOKEN: 'Token không hợp lệ',
  EXPIRED_TOKEN: 'Token đã hết hạn',
  TOKEN_REQUIRED: 'Token là bắt buộc',

  // User Messages
  USER_NOT_FOUND: 'Người dùng không tồn tại',
  USER_DELETED: 'Xóa người dùng thành công',

  // Server Messages
  INTERNAL_SERVER_ERROR: 'Lỗi máy chủ nội bộ',
  UNAUTHORIZED: 'Không được phép',
  FORBIDDEN: 'Cấm truy cập',
};

module.exports = MESSAGES;
