const mongoose = require('mongoose');

const unbanRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Nội dung yêu cầu không được vượt quá 1000 ký tự'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Ghi chú admin không được vượt quá 1000 ký tự'],
    },
    banReasonSnapshot: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Lý do khóa snapshot không được vượt quá 500 ký tự'],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UnbanRequest', unbanRequestSchema);
