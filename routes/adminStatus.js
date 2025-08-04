const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");

// GET /api/admin-status
router.get("/", async (req, res) => {
  try {
    const admins = await Admin.find().lean();
    const now = Date.now();

    const status = admins.map((admin) => {
      const secondsOnline = admin.lastSeen ? Math.floor((now - new Date(admin.lastSeen)) / 1000) : 0;
      const isOnline = secondsOnline < 60; // Online om aktiv senaste 60 sekunder

      return {
        name: admin.name,
        email: admin.email,
        status: isOnline ? "LIVE 🟢" : "OFFLINE 🔴",
        lastSeen: admin.lastSeen,
        secondsOnline
      };
    });

    res.json(status);
  } catch (err) {
    console.error("❌ Fel vid hämtning av adminstatus:", err);
    res.status(500).json({ message: "Serverfel" });
  }
});

module.exports = router;
