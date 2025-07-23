const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
  customerId: mongoose.Schema.Types.ObjectId,
  sessionId: String,
  messages: Array,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Case", caseSchema);
