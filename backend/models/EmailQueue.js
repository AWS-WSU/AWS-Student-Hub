const mongoose = require('mongoose');

const emailQueueSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    // Store event data snapshot in case event is deleted/modified
    eventSnapshot: {
      title: String,
      startTime: Date,
      isRemote: Boolean,
      zoomLink: String,
      address: String,
      directions: String,
      locationName: String,
      description: String,
      thumbnailUrl: String,
      meetupUrl: String,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    lastAttempt: {
      type: Date,
    },
    nextAttempt: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

emailQueueSchema.index({ status: 1, nextAttempt: 1 });
emailQueueSchema.index({ eventId: 1 });
emailQueueSchema.index({ email: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('EmailQueue', emailQueueSchema);
