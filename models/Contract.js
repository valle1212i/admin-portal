const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  filename: { type: String, required: true },
  fileUrl: { type: String, required: true },
  status: { type: String, enum: ["Aktivt", "Utgått", "Pågående"], default: "Pågående" },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Contract', contractSchema);
