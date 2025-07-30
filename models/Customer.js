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

// 🧱 Flexibelt schema för okända fält
const CustomerSchema = new mongoose.Schema({}, { strict: false });

// 🧍 Modell baserad på "customers"-collection
const Customer = customerConnection.model("Customer", CustomerSchema, "customers");

module.exports = Customer;
