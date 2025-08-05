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
  ]
}, { strict: false }); // ⬅️ Gör att andra fält tillåts utöver supportHistory

// 🧍 Modell baserad på "customers"-collection
const Customer = customerConnection.model("Customer", CustomerSchema, "customers");

module.exports = Customer;
