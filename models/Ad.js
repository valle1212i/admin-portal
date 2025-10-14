// admin/models/Ad.js
const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  platform:       { type: String, enum: ['google','meta','tiktok','linkedin'], required: false, index: true }, // Made optional for non-ad submissions

  // NEW: Categorization field
  category: {
    type: String,
    enum: ['ads', 'ai-studio', 'radgivning'],
    required: true,
    index: true,
    default: 'ads'
  },

  // Primär payload
  answers:        { type: Object, default: {} },   // { q1..q7, ... }
  contact:        { type: Object, default: {} },   // { name, email } (valfritt)
  meta:           { type: Object, default: {} },   // { source, ip, ua, userId ... }

  // AI Studio specific fields
  aiStudioData: {
    generatedImages: [{ type: String }], // URLs to generated images
    generatedPDFs: [{ type: String }],   // URLs to generated PDFs
    generationType: { type: String },    // 'poster', 'banner', etc.
    prompt: { type: String }
  },

  // Rådgivning specific fields
  radgivningData: {
    questions: [{ 
      question: String, 
      answer: String 
    }],
    sessionId: { type: String },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'], 
      default: 'medium' 
    }
  },

  // Idempotens & status
  idempotencyKey: { type: String, required: true, unique: true },
  status:         { type: String, enum: ['submitted','in_review','approved','rejected','needs_more_info'], default: 'submitted' }
}, {
  timestamps: true,
  minimize: false
});

// Index för fart och anti-dublett
AdSchema.index({ idempotencyKey: 1 }, { unique: true });
AdSchema.index({ tenantId: 1, platform: 1, createdAt: -1 });
AdSchema.index({ status: 1 });
AdSchema.index({ category: 1, createdAt: -1 }); // NEW: Category index
AdSchema.index({ 'aiStudioData.generationType': 1 }); // NEW: AI Studio index
AdSchema.index({ 'radgivningData.sessionId': 1 }); // NEW: Rådgivning index

// (Valfritt) textindex om du vill stödja free-text-sökning i q-fält:
/// AdSchema.index({
///   'answers.q1': 'text', 'answers.q2': 'text', 'answers.q3': 'text',
///   'answers.q4': 'text', 'answers.q5': 'text', 'answers.q6': 'text', 'answers.q7': 'text'
/// });

module.exports = mongoose.model('Ad', AdSchema);
