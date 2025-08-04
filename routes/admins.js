const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");

// Hämta alla admins
router.get("/", async (req, res) => {
  try {
    const admins = await Admin.find({}, "_id name email").lean();
    res.json(admins);
  } catch (err) {
    console.error("❌ Kunde inte hämta admins:", err);
    res.status(500).json({ message: "Serverfel vid hämtning av admins" });
  }
});

module.exports = router;
