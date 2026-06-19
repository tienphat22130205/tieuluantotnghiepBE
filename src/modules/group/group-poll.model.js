const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    voters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { _id: true }
);

const groupPollSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Câu hỏi không được vượt quá 500 ký tự'],
    },
    options: {
      type: [pollOptionSchema],
      validate: {
        validator: (v) => v.length >= 2 && v.length <= 10,
        message: 'Poll phải có từ 2 đến 10 lựa chọn',
      },
    },
    allowMultiple: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GroupPoll', groupPollSchema);
