const mongoose = require('mongoose');

const AdminStudioRådgivningSchema = new mongoose.Schema({
  // Common fields for both AI Studio and Rådgivning
  customerEmail: {
    type: String,
    required: true,
    index: true
  },
  customerName: {
    type: String,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'pending'],
    default: 'open',
    index: true
  },
  tenantId: {
    type: String,
    index: true
  },
  userId: {
    type: String,
    index: true
  },
  userEmail: {
    type: String,
    index: true
  },
  tags: [{
    type: String
  }],

  // AI Studio specific fields
  platform: {
    type: String,
    enum: ['google', 'meta', 'tiktok', 'linkedin'],
    index: true
  },
  answers: {
    q1: String,
    q2: String,
    q3: String,
    q4: String,
    q5: String,
    q6: String,
    q7: String,
    extraInfo: String
  },
  // Legacy AI Studio fields for backward compatibility
  q1: String,
  q2: String,
  q3: String,
  q4: String,
  q5: String,
  q6: String,
  q7: String,
  extraInfo: String,

  // Rådgivning specific fields
  sessionId: {
    type: String,
    index: true
  },
  messages: [{
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    sender: {
      type: String,
      enum: ['customer', 'admin', 'system']
    },
    messageId: String
  }],
  topic: String,
  description: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedAdmin: String,
  closedAt: Date,
  closedBy: String,

  // Metadata
  source: {
    type: String,
    enum: ['ai-studio', 'radgivning', 'manual'],
    required: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  collection: 'studioradgivning'
});

// Indexes for better query performance
AdminStudioRådgivningSchema.index({ customerEmail: 1, createdAt: -1 });
AdminStudioRådgivningSchema.index({ platform: 1, createdAt: -1 });
AdminStudioRådgivningSchema.index({ sessionId: 1 });
AdminStudioRådgivningSchema.index({ status: 1, createdAt: -1 });
AdminStudioRådgivningSchema.index({ source: 1, createdAt: -1 });

// Pre-save middleware to update updatedAt
AdminStudioRådgivningSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to determine data type
AdminStudioRådgivningSchema.statics.getDataType = function(doc) {
  if (doc.platform || doc.answers || doc.q1 || doc.q2 || doc.q3 || doc.q4 || doc.q5 || doc.q6 || doc.q7) {
    return 'ai-studio';
  }
  if (doc.sessionId || doc.messages || doc.topic) {
    return 'radgivning';
  }
  return 'unknown';
};

// Instance method to get preview text
AdminStudioRådgivningSchema.methods.getPreview = function() {
  if (this.source === 'ai-studio') {
    const answers = this.answers || {};
    const previewTexts = [];
    ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'extraInfo'].forEach(k => {
      if (answers[k] && answers[k].trim()) {
        previewTexts.push(answers[k].trim());
      }
    });
    return previewTexts.slice(0, 3).join(' | ');
  } else if (this.source === 'radgivning') {
    return this.description || this.topic || (this.messages && this.messages.length > 0 ? this.messages[0].message : '');
  }
  return '';
};

module.exports = mongoose.model('AdminStudioRådgivning', AdminStudioRådgivningSchema);
