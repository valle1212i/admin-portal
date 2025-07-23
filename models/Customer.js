const mongoose = require("mongoose");

// Skapa en separat anslutning till kundportalen
const customerConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  dbName: "kundportal",
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Skapa en flexibel schema (vi vet inte exakt vilka fält kunden har)
const CustomerSchema = new mongoose.Schema({}, { strict: false });

// Skapa modellen
const Customer = customerConnection.model("Customer", CustomerSchema);

module.exports = Customer;
