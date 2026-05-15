const AIService = require('./ai.service');
const { sendSuccess, sendError } = require('../../utils/response');

class AIController {
  static async detectLocation(req, res) {
    try {
      const result = await AIService.detectLocationByIp(req);

      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async generatePostContentUpload(req, res) {
    try {
      const result = await AIService.generateContentFromUploadedImages(req.files || [], req.body || {});

      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = AIController;
