// routes/serverStatus.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Anslut till kundportalen (extern databas)
const customerPortalConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Modell för serverstatus
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
