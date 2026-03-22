const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return sendError(res, 400, messages[0]);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, 409, `${field} đã được sử dụng`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Token không hợp lệ');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Token đã hết hạn');
  }

  // Default error
  return sendError(
    res,
    err.statusCode || 500,
    err.message || 'Lỗi máy chủ nội bộ'
  );
};

module.exports = errorHandler;
