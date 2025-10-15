const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  topic: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 300
  },
  messages: [
    {
      sender: {
        type: String,
        enum: ["admin", "customer", "system"],
        required: true
      },
      senderName: {
        type: String
      },
      senderEmail: {
        type: String
      },
      message: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null
  },
  adminAssignmentHistory: [
    {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true
      },
      adminName: {
        type: String,
        required: true
      },
      adminEmail: {
        type: String,
        required: true
      },
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true
      },
      assignedByName: {
        type: String,
        required: true
      },
      assignedAt: {
        type: Date,
        default: Date.now
      },
      action: {
        type: String,
        enum: ["assigned", "reassigned", "unassigned"],
        default: "assigned"
      }
    }
  ],
  status: {
    type: String,
    enum: ["new", "in_progress", "waiting", "on_hold", "closed", "open"],
    default: "new"
  },
  internalNotes: [
    {
      note: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Case", caseSchema);
