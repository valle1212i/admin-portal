const mongoose = require("mongoose");

const AdminSessionSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  durationSeconds: Number
});

module.exports = mongoose.model("AdminSession", AdminSessionSchema);
