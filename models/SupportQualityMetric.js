const mongoose = require('mongoose');

const supportQualityMetricSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    unique: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  assignedAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    index: true
  },
  firstResponseTime: {
    type: Number, // minutes
    default: null
  },
  resolutionTime: {
    type: Number, // minutes
    default: null
  },
  customerSatisfactionRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  customerFeedback: {
    type: String
  },
  numberOfMessages: {
    type: Number,
    default: 0
  },
  numberOfAdminSwitches: {
    type: Number,
    default: 0
  },
  wasEscalated: {
    type: Boolean,
    default: false
  },
  reopened: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String
  }],
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date
  }
});

// Indexes for analytics
supportQualityMetricSchema.index({ assignedAdminId: 1, timestamp: -1 });
supportQualityMetricSchema.index({ customerSatisfactionRating: 1 });
supportQualityMetricSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SupportQualityMetric', supportQualityMetricSchema);

