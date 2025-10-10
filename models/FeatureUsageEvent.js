const mongoose = require('mongoose');

const featureUsageEventSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  userId: {
    type: String,
    index: true
  },
  feature: {
    type: String,
    enum: [
      'invoicing',
      'contracts',
      'chat',
      'marketing_google',
      'marketing_meta',
      'marketing_tiktok',
      'marketing_linkedin',
      'analytics',
      'inventory',
      'payments',
      'reports',
      'settings',
      'support',
      'dashboard'
    ],
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['view', 'create', 'update', 'delete', 'export', 'download'],
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  sessionId: {
    type: String,
    index: true
  },
  duration: {
    type: Number, // seconds
    default: 0
  },
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown'
  },
  browserInfo: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for analytics queries
featureUsageEventSchema.index({ customerId: 1, timestamp: -1 });
featureUsageEventSchema.index({ feature: 1, timestamp: -1 });
featureUsageEventSchema.index({ feature: 1, action: 1 });
featureUsageEventSchema.index({ timestamp: -1 });

module.exports = mongoose.model('FeatureUsageEvent', featureUsageEventSchema);

