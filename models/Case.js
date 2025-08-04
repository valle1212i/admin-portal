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
  status: {
    type: String,
    enum: ["new", "in_progress", "waiting", "on_hold", "closed"],
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
