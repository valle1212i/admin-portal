const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// 🔗 Skapa separat MongoDB-koppling till kundportalen
const customerConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  dbName: "kundportal",
});

// 🧱 Definiera Customer-modellen för kundportalen
const Customer = customerConnection.model(
  "Customer",
  new mongoose.Schema({}, { strict: false }),
  "customers"
);

// 🧱 Definiera User-modellen för att spåra online-användare
const User = customerConnection.model(
  "User",
  new mongoose.Schema({
    lastLogin: Date,
    isOnline: { type: Boolean, default: false },
    lastSeen: Date
  }, { strict: false }),
  "users"
);

// 📊 Hämta dashboard-statistik
router.get("/stats", async (req, res) => {
  try {
    // Hämta totalt antal kunder
    const totalCustomers = await Customer.countDocuments();
    
    // Hämta antal online-användare (senaste 5 minuter)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsers = await User.countDocuments({
      lastSeen: { $gte: fiveMinutesAgo }
    });

    res.json({
      totalCustomers,
      activeCustomers: totalCustomers, // Som du sa, vi lämnar detta som det är för nu
      currentlyOnline: onlineUsers
    });
  } catch (err) {
    console.error("❌ Fel vid hämtning av dashboard-statistik:", err);
    res.status(500).json({ 
      error: "Kunde inte hämta dashboard-statistik",
      totalCustomers: 0,
      activeCustomers: 0,
      currentlyOnline: 0
    });
  }
});

// 🔄 Uppdatera användarens online-status (anropas från kundportalen)
router.post("/user-online", async (req, res) => {
  try {
    const { userId, isOnline } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId krävs" });
    }

    // Uppdatera användarens lastSeen och isOnline status
    await User.findByIdAndUpdate(userId, {
      lastSeen: new Date(),
      isOnline: isOnline !== false // Default till true om inte explicit false
    }, { upsert: true }); // Skapa användaren om den inte finns

    res.json({ success: true, message: "Online-status uppdaterad" });
  } catch (err) {
    console.error("❌ Fel vid uppdatering av online-status:", err);
    res.status(500).json({ error: "Kunde inte uppdatera online-status" });
  }
});

module.exports = router;
