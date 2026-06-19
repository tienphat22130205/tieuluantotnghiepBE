const mongoose = require('mongoose');

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'text'],
      required: true,
    },
    mediaUrl: {
      type: String,
      default: '',
    },
    textContent: {
      type: String,
      default: '',
      trim: true,
    },
    bgColor: {
      type: String,
      default: '',
    },
    textColor: {
      type: String,
      default: '',
    },
    spotifyUrl: {
      type: String,
      default: '',
    },
    music: {
      title: {
        type: String,
        default: '',
      },
      artist: {
        type: String,
        default: '',
      },
    },
    viewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Play/display duration of the story in seconds (max 5 minutes / 300 seconds)
    duration: {
      type: Number,
      default: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Story', storySchema);
