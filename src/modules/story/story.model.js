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
        reaction: {
          type: String,
          default: '',
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
    // CSS filter preset for image/video stories
    imageFilter: {
      type: String,
      default: 'none',
    },
    // CSS object-fit for image display
    objectFit: {
      type: String,
      enum: ['cover', 'contain'],
      default: 'cover',
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
