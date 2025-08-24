// models/LoginEvent.js
const mongoose = require('mongoose');

const loginEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  ip: { type: String, default: '' },
  device: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

// Valfritt: index för snabb sortering på senaste logins
loginEventSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('LoginEvent', loginEventSchema);
