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

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const originalExt = path.extname(file.originalname || '').toLowerCase();
    const fallbackExt = file.mimetype ? `.${String(file.mimetype).split('/').pop()}` : '';
    const ext = originalExt || fallbackExt || '.jpg';
    const fileName = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, fileName);
  },
});

const postStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, postUploadDir);
  },
  filename: (req, file, cb) => {
    const originalExt = path.extname(file.originalname || '').toLowerCase();
    const fallbackExt = file.mimetype ? `.${String(file.mimetype).split('/').pop()}` : '';
    const ext = originalExt || fallbackExt || '.jpg';
    const fileName = `post-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (!allowedImageTypes.includes(ext)) {
    return cb(new Error(`Định dạng file không hợp lệ. Chỉ chấp nhận: ${allowedImageTypes.join(', ')}`));
  }
  return cb(null, true);
};

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024);

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
  },
});

const uploadPostImages = multer({
  storage: postStorage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
  },
});

module.exports = {
  uploadAvatar,
  uploadPostImages,
};
