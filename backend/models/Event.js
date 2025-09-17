const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140
  },
  startTime: {
    type: Date,
    required: true
  },
  isRemote: {
    type: Boolean,
    required: true
  },
  zoomLink: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  directions: {
    type: String,
    trim: true,
    maxlength: 250,
    default: ''
  },
  locationName: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  thumbnailUrl: {
    type: String,
    trim: true,
    default: ''
  },
  meetupUrl: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Event', eventSchema);


