const mongoose = require("mongoose");

// ✅ Säkerställ att URI finns
if (!process.env.CUSTOMER_DB_URI) {
  throw new Error("❌ CUSTOMER_DB_URI är inte definierad i miljövariablerna.");
}

// 🌐 Egen anslutning till kunddatabas
const customerConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  dbName: "kundportal",
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 🧱 Schema med supportHistory inbäddat
const CustomerSchema = new mongoose.Schema({
  // Tillåt andra fält också
  supportHistory: [
    {
      topic: String,
      date: Date,
      status: String
    }
  ],
  // Package Management Fields
  package: { 
    type: String, 
    enum: ['Bas', 'Grower', 'Enterprise'], 
    default: 'Bas' 
  },
  packageChangeRequests: [{
    requestedPackage: String,
    requestedBy: String,
    requestedAt: Date,
    approvedBy: String,
    approvedAt: Date,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    effectiveDate: { type: String, enum: ['immediate', 'next_billing'] }
  }],
  maxUsers: { type: Number, default: 2 },
  currentUserCount: { type: Number, default: 1 },
  // Agreement Status Fields
  agreementStatus: { 
    type: String, 
    enum: ['active', 'terminated', 'read_only'], 
    default: 'active' 
  },
  terminationDate: Date,
  terminationEffectiveDate: Date,
  terminationReason: String,
  dataRetentionUntil: Date,
  billingCycleEnd: Date
}, { strict: false }); // ⬅️ Gör att andra fält tillåts utöver supportHistory

// 🧍 Modell baserad på "customers"-collection
const Customer = customerConnection.model("Customer", CustomerSchema, "customers");

module.exports = Customer;
