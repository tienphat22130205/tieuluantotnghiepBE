const sendResponse = (res, statusCode, message, data = null, error = null) => {
  res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
    error,
  });
};

const sendSuccess = (res, statusCode, message, data = null) => {
  sendResponse(res, statusCode, message, data, null);
};

const sendError = (res, statusCode, message, error = null) => {
  sendResponse(res, statusCode, message, null, error);
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendError,
};
