const jwt = require('jsonwebtoken');
const User = require('./auth.model');
const { generateToken } = require('../../utils/jwt');
const { validateEmail, validatePhone, validatePassword, validateUsername } = require('../../utils/validation');
const { MESSAGES, HTTP_STATUS, ROLES } = require('../../constants');
const emailService = require('../../services/email.service');

class AuthService {
  // Register new user
  static async register(userData) {
    try {
      const { username, email, phone, password, confirmPassword } = userData;

      // Validation
      if (!username || !email || !phone || !password || !confirmPassword) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.MISSING_FIELDS,
        };
      }

      // Validate username format
      if (!validateUsername(username)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Tên người dùng phải có 3-20 ký tự, chỉ chứa chữ, số và dấu gạch dưới',
        };
      }

      // Validate email format
      if (!validateEmail(email)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.INVALID_EMAIL,
        };
      }

      // Validate phone format
      if (!validatePhone(phone)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.INVALID_PHONE,
        };
      }

      // Validate password
      if (!validatePassword(password)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.WEAK_PASSWORD,
        };
      }

      // Check password match
      if (password !== confirmPassword) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Mật khẩu không khớp',
        };
      }

      // Check if email already exists
      let existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return {
          success: false,
          statusCode: HTTP_STATUS.CONFLICT,
          message: MESSAGES.EMAIL_ALREADY_EXISTS,
        };
      }

      // Check if username already exists
      existingUser = await User.findOne({ username });
      if (existingUser) {
        return {
          success: false,
          statusCode: HTTP_STATUS.CONFLICT,
          message: MESSAGES.USERNAME_ALREADY_EXISTS,
        };
      }

      // Check if phone already exists
      existingUser = await User.findOne({ phone });
      if (existingUser) {
        return {
          success: false,
          statusCode: HTTP_STATUS.CONFLICT,
          message: MESSAGES.PHONE_ALREADY_EXISTS,
        };
      }

      // Create new user
      const newUser = new User({
        username,
        email: email.toLowerCase(),
        phone,
        password,
        role: ROLES.USER,
        verified: false, // Email not verified yet
      });

      await newUser.save();

      // Generate verification token (24 hours expiry)
      const verificationToken = jwt.sign(
        {
          userId: newUser._id,
          email: newUser.email,
          type: 'email_verification',
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Save verification token to database
      newUser.verificationToken = verificationToken;
      newUser.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await newUser.save();

      // Send verification email
      const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      const emailResult = await emailService.sendVerificationEmail(newUser.email, verificationLink);

      if (!emailResult.success) {
        console.warn('Failed to send verification email:', emailResult.error);
        // Still return success to user, they can resend email later
      }

      return {
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
        data: {
          user: newUser.toJSON(),
          message: 'Một email xác thực đã được gửi đến ' + newUser.email,
        },
      };
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Login user
  static async login(loginData) {
    try {
      const { email, password } = loginData;

      // Validation
      if (!email || !password) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.MISSING_FIELDS,
        };
      }

      // Validate email format
      if (!validateEmail(email)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.INVALID_EMAIL,
        };
      }

      // Find user and select password field
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          message: MESSAGES.LOGIN_FAILED,
        };
      }

      // Check if user is active
      if (!user.isActive) {
        return {
          success: false,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          message: 'Tài khoản này đã bị khóa',
        };
      }

      // Check if email is verified
      if (!user.verified) {
        return {
          success: false,
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Vui lòng xác thực email trước khi đăng nhập. Hãy kiểm tra email của bạn để nhận link xác thực.',
        };
      }

      // Compare passwords
      const isPasswordCorrect = await user.comparePassword(password);

      if (!isPasswordCorrect) {
        return {
          success: false,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          message: MESSAGES.LOGIN_FAILED,
        };
      }

      if (!user.role) {
        user.role = ROLES.USER;
        await user.save();
      }

      // Generate token with role for RBAC
      const roleToken = generateToken(user._id, user.email, user.role);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: MESSAGES.LOGIN_SUCCESS,
        data: {
          user: user.toJSON(),
          token: roleToken,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get user by ID
  static async getUserById(userId) {
    try {
      const user = await User.findById(userId).populate('followers following');

      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        data: user,
      };
    } catch (error) {
      console.error('Get user error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Verify email
  static async verifyEmail(token) {
    try {
      if (!token) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Token xác thực không được cung cấp',
        };
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return {
            success: false,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Token xác thực đã hết hạn. Vui lòng đăng ký lại.',
          };
        }
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Token xác thực không hợp lệ',
        };
      }

      // Find user
      const user = await User.findById(decoded.userId);

      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Người dùng không tìm thấy',
        };
      }

      // Check if already verified
      if (user.verified) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Email đã được xác thực rồi',
        };
      }

      // Check token expiry date in database
      if (user.verificationTokenExpiry < new Date()) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Token xác thực đã hết hạn. Vui lòng đăng ký lại.',
        };
      }

      // Update user - mark as verified
      user.verified = true;
      user.verificationToken = null;
      user.verificationTokenExpiry = null;
      await user.save();

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Email xác thực thành công! Bạn có thể đăng nhập ngay bây giờ.',
        data: {
          verified: true,
          email: user.email,
        },
      };
    } catch (error) {
      console.error('Verify email error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Update role (admin only)
  static async updateUserRole(userId, role) {
    try {
      const normalizedRole = String(role || '').toLowerCase();

      if (![ROLES.USER, ROLES.MODERATOR, ROLES.ADMIN].includes(normalizedRole)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Role không hợp lệ. Chỉ chấp nhận: user, moderator, admin',
        };
      }

      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      user.role = normalizedRole;
      await user.save();

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Cập nhật role thành công',
        data: user.toJSON(),
      };
    } catch (error) {
      console.error('Update role error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }
}

module.exports = AuthService;
