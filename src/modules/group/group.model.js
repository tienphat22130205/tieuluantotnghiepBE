const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Tên nhóm không được vượt quá 100 ký tự'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Mô tả nhóm không được vượt quá 1000 ký tự'],
    },
    coverImage: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    privacy: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memberCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    postCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

groupSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Group', groupSchema);
