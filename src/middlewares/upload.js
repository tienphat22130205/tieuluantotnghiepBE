const fs = require('fs');
const path = require('path');
const multer = require('multer');

const avatarUploadDir = path.join(__dirname, '../../uploads/avatars');
const postUploadDir = path.join(__dirname, '../../uploads/posts');

if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

if (!fs.existsSync(postUploadDir)) {
  fs.mkdirSync(postUploadDir, { recursive: true });
}

const allowedImageTypes = String(process.env.ALLOWED_IMAGE_TYPES || 'jpg,jpeg,png,gif,webp')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (!allowedImageTypes.includes(ext)) {
    return cb(new Error(`Định dạng file không hợp lệ. Chỉ chấp nhận: ${allowedImageTypes.join(', ')}`));
  }
  return cb(null, true);
};

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024);

const memoryStorage = multer.memoryStorage();

const uploadAvatar = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
  },
});

const uploadPostImages = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
  },
});

const uploadPostImagesMemory = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
  },
});

const storyFileFilter = (req, file, cb) => {
  const isVideo = file.mimetype.startsWith('video/');
  const isImage = file.mimetype.startsWith('image/');
  if (!isImage && !isVideo) {
    return cb(new Error('Chỉ chấp nhận file hình ảnh hoặc video!'), false);
  }
  cb(null, true);
};

const uploadStoryMedia = multer({
  storage: memoryStorage,
  fileFilter: storyFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for video support
  },
});

module.exports = {
  uploadAvatar,
  uploadPostImages,
  uploadPostImagesMemory,
  uploadStoryMedia,
};
