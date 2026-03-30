const axios = require('axios');
const FormData = require('form-data');
const { HTTP_STATUS } = require('../../constants');

const ALLOWED_LANGUAGES = ['vi', 'en'];
const ALLOWED_TONES = ['fun', 'chill', 'professional'];
const ALLOWED_LENGTHS = ['short', 'medium', 'long'];

class AIService {
  static normalizeParams(payload = {}) {
    const language = String(payload.language || 'vi').toLowerCase();
    const tone = String(payload.tone || 'chill').toLowerCase();
    const length = String(payload.length || 'medium').toLowerCase();
    const includeHashtags = String(payload.includeHashtags ?? 'true').toLowerCase() === 'true';

    let numCaptions = Number(payload.numCaptions || 1);
    if (!Number.isFinite(numCaptions)) {
      numCaptions = 1;
    }

    return {
      language,
      tone,
      length,
      includeHashtags,
      numCaptions,
    };
  }

  static validateParams(params) {
    if (!ALLOWED_LANGUAGES.includes(params.language)) {
      return 'language không hợp lệ. Chỉ chấp nhận: vi, en';
    }

    if (!ALLOWED_TONES.includes(params.tone)) {
      return 'tone không hợp lệ. Chỉ chấp nhận: fun, chill, professional';
    }

    if (!ALLOWED_LENGTHS.includes(params.length)) {
      return 'length không hợp lệ. Chỉ chấp nhận: short, medium, long';
    }

    if (params.numCaptions < 1 || params.numCaptions > 3) {
      return 'numCaptions phải trong khoảng 1..3';
    }

    return null;
  }

  static async generateContentFromUploadedImages(files = [], payload = {}) {
    try {
      if (!Array.isArray(files) || files.length === 0) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Vui lòng upload ít nhất 1 ảnh với key images',
        };
      }

      const params = this.normalizeParams(payload);
      const paramsError = this.validateParams(params);
      if (paramsError) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: paramsError,
        };
      }

      const aiBaseUrl = String(process.env.AI_API_BASE_URL || '').trim();
      if (!aiBaseUrl) {
        return {
          success: false,
          statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
          message: 'Thiếu cấu hình AI_API_BASE_URL trong .env',
        };
      }

      const aiPath = String(process.env.AI_GENERATE_UPLOAD_PATH || '/api/generate-content-upload').trim();
      const aiUrl = `${aiBaseUrl.replace(/\/$/, '')}${aiPath.startsWith('/') ? aiPath : `/${aiPath}`}`;

      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append('images', file.buffer, {
          filename: file.originalname || `image-${index + 1}.jpg`,
          contentType: file.mimetype || 'application/octet-stream',
        });
      });

      formData.append('language', params.language);
      formData.append('tone', params.tone);
      formData.append('length', params.length);
      formData.append('includeHashtags', String(params.includeHashtags));
      formData.append('numCaptions', String(params.numCaptions));

      const headers = {
        ...formData.getHeaders(),
      };

      if (process.env.AI_API_KEY) {
        headers.Authorization = `Bearer ${process.env.AI_API_KEY}`;
      }

      const response = await axios.post(aiUrl, formData, {
        headers,
        timeout: Number(process.env.AI_API_TIMEOUT_MS || 45000),
        maxBodyLength: Infinity,
      });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Sinh nội dung AI thành công',
        data: response.data,
      };
    } catch (error) {
      const status = error.response?.status || HTTP_STATUS.SERVICE_UNAVAILABLE;
      const upstreamMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      return {
        success: false,
        statusCode: status,
        message: 'AI service lỗi hoặc không phản hồi',
        error: upstreamMessage,
      };
    }
  }
}

module.exports = AIService;
