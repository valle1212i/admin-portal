// models/Broadcast.js
const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  subject:    { type: String, required: true },
  html:       { type: String, default: '' },
  text:       { type: String, default: '' },
  fromName:   { type: String, default: 'Source Team' },
  createdAt:  { type: Date, default: Date.now },
  readAt:     { type: Date, default: null },
});

// För snabb lista per kund
broadcastSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Broadcast', broadcastSchema);
