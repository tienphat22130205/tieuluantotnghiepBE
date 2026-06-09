const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('Cloudinary has been successfully configured.');
} else {
  console.log('Cloudinary is not configured. Falling back to local disk storage uploads.');
}

/**
 * Uploads a file buffer directly to Cloudinary.
 * @param {Object} file - Express multer file object (in memory)
 * @param {String} folder - Subfolder under Giphy / Zivo uploads (e.g. 'avatars', 'posts')
 * @returns {Promise<String>} Secure URL of the uploaded image
 */
const uploadToCloudinary = (file, folder = 'general') => {
  return new Promise((resolve, reject) => {
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    cloudinary.uploader.upload(
      base64Image,
      {
        folder: `zivo/${folder}`,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );
  });
};

/**
 * Saves a file buffer locally on the server filesystem.
 * @param {Object} file - Express multer file object (in memory)
 * @param {String} folder - Subfolder name under uploads (e.g. 'avatars', 'posts')
 * @returns {Promise<String>} Relative path of the saved file
 */
const saveBufferLocally = async (file, folder = 'general') => {
  const uploadDir = path.join(__dirname, `../../uploads/${folder}`);
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const originalExt = path.extname(file.originalname || '').toLowerCase();
  const fallbackExt = file.mimetype ? `.${String(file.mimetype).split('/').pop()}` : '';
  const ext = originalExt || fallbackExt || '.jpg';
  
  const fileName = `${folder}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filePath = path.join(uploadDir, fileName);
  
  await fs.promises.writeFile(filePath, file.buffer);
  
  return `/uploads/${folder}/${fileName}`;
};

/**
 * Saves a file by choosing Cloudinary if configured, otherwise falls back to local storage.
 * @param {Object} file - Express multer file object
 * @param {String} folder - Thư mục lưu trữ (avatars / posts)
 * @returns {Promise<String>} File URL (Cloudinary URL or local relative path)
 */
const saveFile = async (file, folder = 'general') => {
  if (!file || !file.buffer) {
    throw new Error('File buffer is empty or missing.');
  }
  
  if (isCloudinaryConfigured) {
    try {
      return await uploadToCloudinary(file, folder);
    } catch (error) {
      console.error('Failed to upload to Cloudinary, falling back to local storage:', error);
      return await saveBufferLocally(file, folder);
    }
  } else {
    return await saveBufferLocally(file, folder);
  }
};

module.exports = {
  isCloudinaryConfigured,
  uploadToCloudinary,
  saveBufferLocally,
  saveFile,
};
