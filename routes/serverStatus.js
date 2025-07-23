const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

require("dotenv").config(); // Lägg till detta direkt här om den körs fristående

// Säkerställ att URI finns
if (!process.env.CUSTOMER_DB_URI) {
  throw new Error("❌ CUSTOMER_DB_URI saknas i miljövariabler");
}

// Skapa separat connection
const customerPortalConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Modell för serverstatus (kan skapas direkt från separat connection)
const ServerStatus = customerPortalConnection.model("ServerStatus", new mongoose.Schema({
  name: String,
  status: String,
  uptime: String,
  load: String,
  lastChecked: Date,
}));

// GET /api/server-status
router.get("/", async (req, res) => {
  try {
    const status = await ServerStatus.find();
    res.json(status);
  } catch (error) {
    res.status(500).json({ message: "Kunde inte hämta serverstatus", error });
  }
});

module.exports = router;
