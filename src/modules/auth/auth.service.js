const jwt = require('jsonwebtoken');
const User = require('./auth.model');
const { generateToken } = require('../../utils/jwt');
const {
  validateEmail,
  validatePhone,
  validatePassword,
  validateUsername,
  validateDateOfBirth,
  isAtLeastAge,
} = require('../../utils/validation');
const { MESSAGES, HTTP_STATUS, ROLES } = require('../../constants');
const emailService = require('../../services/email.service');

class AuthService {
  // Register new user
  static async register(userData) {
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
      } = userData;

      // Validation
      if (!email || !phone || !dateOfBirth || !password || !confirmPassword || !firstName || !lastName) {
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

      // Validate phone format
      if (!validatePhone(phone)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.INVALID_PHONE,
        };
      }

      // Validate date of birth
      if (!validateDateOfBirth(dateOfBirth)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.INVALID_DATE_OF_BIRTH,
        };
      }

      // Age gate (must be at least 13 years old)
      if (!isAtLeastAge(dateOfBirth, 13)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.MINIMUM_AGE_REQUIRED,
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

      // Check if phone already exists
      existingUser = await User.findOne({ phone });
      if (existingUser) {
        return {
          success: false,
          statusCode: HTTP_STATUS.CONFLICT,
          message: MESSAGES.PHONE_ALREADY_EXISTS,
        };
      }

      const normalizedLocation = location && typeof location === 'object'
        ? {
            lat: typeof location.lat === 'number' ? location.lat : null,
            lng: typeof location.lng === 'number' ? location.lng : null,
            address: location.address || '',
            city: location.city || '',
            country: location.country || '',
            updatedAt: new Date(),
          }
        : undefined;

      // Create new user
      const newUser = new User({
        username: null, // Username will be set later
        email: email.toLowerCase(),
        phone,
        dateOfBirth: new Date(dateOfBirth),
        password,
        firstName: firstName || '',
        lastName: lastName || '',
        avatar: null,
        location: normalizedLocation,
        role: ROLES.USER,
        verified: false, // Email not verified yet
        usernameSelected: false,
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
          userId: newUser._id,
          email: newUser.email,
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
  static async setUsername(userId, username) {
    try {
      // Validate username
      if (!username) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Vui lòng cung cấp username',
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

      // Check if username already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return {
          success: false,
          statusCode: HTTP_STATUS.CONFLICT,
          message: MESSAGES.USERNAME_ALREADY_EXISTS,
        };
      }

      // Find user and ensure email is verified
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      if (!user.verified) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Email chưa được xác thực. Vui lòng xác thực email trước khi đặt username.',
        };
      }

      // Update username
      user.username = username;
      user.usernameSelected = true;
      await user.save();

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Đặt username thành công',
        data: {
          username: user.username,
          user: user.toJSON(),
        },
      };
    } catch (error) {
      console.error('Set username error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Suggest username for logged-in user
  static async suggestUsername(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      const firstName = (user.firstName || '').trim();
      const lastName = (user.lastName || '').trim();

      if (!firstName || !lastName) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Thiếu firstName hoặc lastName trong hồ sơ người dùng',
        };
      }

      // Create suggested usernames
      const baseUsername = (firstName + lastName).toLowerCase().replace(/\s/g, '');
      const suggestions = [
        baseUsername, // e.g., "johnsmith"
        `${firstName.toLowerCase()}_${lastName.toLowerCase()}`.replace(/\s/g, '_'), // e.g., "john_smith"
        `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}`.replace(/\s/g, ''), // e.g., "jsmith"
      ];

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Gợi ý username thành công',
        data: {
          suggestions,
          note: 'Bạn có thể sử dụng một trong những gợi ý trên hoặc tạo username riêng của mình',
        },
      };
    } catch (error) {
      console.error('Suggest username error:', error);
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
