const mongoose = require('mongoose');

const customerEngagementScoreSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  loginCount: {
    type: Number,
    default: 0
  },
  featuresUsed: [{
    type: String
  }],
  totalSessionTime: {
    type: Number, // minutes
    default: 0
  },
  actionsPerformed: {
    type: Number,
    default: 0
  },
  aiInteractions: {
    type: Number,
    default: 0
  },
  supportTicketsOpened: {
    type: Number,
    default: 0
  },
  engagementScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  healthStatus: {
    type: String,
    enum: ['healthy', 'at_risk', 'churning'],
    default: 'healthy',
    index: true
  }
});

// Compound index for unique daily records per customer
customerEngagementScoreSchema.index({ customerId: 1, date: 1 }, { unique: true });
customerEngagementScoreSchema.index({ date: -1 });
customerEngagementScoreSchema.index({ healthStatus: 1, date: -1 });

module.exports = mongoose.model('CustomerEngagementScore', customerEngagementScoreSchema);

