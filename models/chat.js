const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  sender: { type: String, enum: ["admin", "customer", "system"], required: true },
  senderName: { type: String }, // 👈 namn på avsändaren, t.ex. kundens förnamn
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  sessionId: { type: String, required: true } // 👈 unikt ID för varje session
});

module.exports = mongoose.model("Chat", chatSchema);
