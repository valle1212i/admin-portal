// models/OutboundMessage.js
const mongoose = require('mongoose');

const OutboundSchema = new mongoose.Schema({
  kind:     { type: String, required: true },      // t.ex. 'ad-ingest'
  url:      { type: String, required: true },
  body:     { type: Object, required: true },
  headers:  { type: Object, default: {} },
  attempts: { type: Number, default: 0, index: true },
  lastError:{ type: String, default: '' }
}, { timestamps: true });

// Hjälpindex för köhantering
OutboundSchema.index({ attempts: 1, createdAt: 1 });

module.exports = mongoose.model('OutboundMessage', OutboundSchema);
