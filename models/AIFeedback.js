const mongoose = require('mongoose');

const aiFeedbackSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true
  },
  aiResponse: {
    type: String,
    required: true
  },
  rating: {
    type: String,
    enum: ['positive', 'negative'],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['accuracy', 'helpfulness', 'speed', 'clarity'],
    default: 'helpfulness'
  },
  feedbackText: {
    type: String
  },
  conversationId: {
    type: String,
    index: true
  },
  responseTime: {
    type: Number, // milliseconds
    default: 0
  },
  escalatedToHuman: {
    type: Boolean,
    default: false
  },
  resolved: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for efficient queries
aiFeedbackSchema.index({ customerId: 1, timestamp: -1 });
aiFeedbackSchema.index({ rating: 1, timestamp: -1 });
aiFeedbackSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AIFeedback', aiFeedbackSchema);

