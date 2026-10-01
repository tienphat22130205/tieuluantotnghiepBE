const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Tránh trùng lặp 1 người lưu cùng 1 bài viết nhiều lần
bookmarkSchema.index({ user: 1, post: 1 }, { unique: true });
// Tối ưu truy vấn danh sách bài viết đã lưu theo thời gian mới nhất
bookmarkSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
