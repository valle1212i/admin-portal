// admin/models/Ad.js
const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  platform:       { type: String, enum: ['google','meta','tiktok','linkedin'], required: true, index: true },

  // Primär payload
  answers:        { type: Object, default: {} },   // { q1..q7, ... }
  contact:        { type: Object, default: {} },   // { name, email } (valfritt)
  meta:           { type: Object, default: {} },   // { source, ip, ua, userId ... }

  // Idempotens & status
  idempotencyKey: { type: String, required: true, unique: true },
  status:         { type: String, enum: ['submitted','in_review','approved','rejected','needs_more_info'], default: 'submitted', index: true }
}, {
  timestamps: true,
  minimize: false
});

// Index för fart och anti-dublett
AdSchema.index({ idempotencyKey: 1 }, { unique: true });
AdSchema.index({ tenantId: 1, platform: 1, createdAt: -1 });
AdSchema.index({ status: 1 });

// (Valfritt) textindex om du vill stödja free-text-sökning i q-fält:
/// AdSchema.index({
///   'answers.q1': 'text', 'answers.q2': 'text', 'answers.q3': 'text',
///   'answers.q4': 'text', 'answers.q5': 'text', 'answers.q6': 'text', 'answers.q7': 'text'
/// });

module.exports = mongoose.model('Ad', AdSchema);
