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

// 🧱 Definiera LoginEvent-modellen för att spåra online-användare
const LoginEvent = customerConnection.model(
  "LoginEvent",
  new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    ip: { type: String, default: '' },
    device: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  }, { strict: false }),
  "loginevents"
);

// 🧱 Definiera User-modellen för att spåra online-användare (fallback)
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
    
    // Hämta antal online-användare baserat på LoginEvent (senaste 15 minuter)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // Försök först att använda LoginEvent
    let onlineUsers = 0;
    try {
      // Hitta unika användare som har loggat in senaste 15 minuter
      const recentLoginEvents = await LoginEvent.aggregate([
        {
          $match: {
            timestamp: { $gte: fifteenMinutesAgo }
          }
        },
        {
          $group: {
            _id: "$userId",
            lastLogin: { $max: "$timestamp" }
          }
        },
        {
          $count: "uniqueUsers"
        }
      ]);
      
      onlineUsers = recentLoginEvents.length > 0 ? recentLoginEvents[0].uniqueUsers : 0;
      console.log(`📊 Online users from LoginEvent: ${onlineUsers}`);
      
    } catch (loginEventError) {
      console.log("⚠️ LoginEvent collection not found, trying User collection...");
      
      // Fallback till User collection om LoginEvent inte finns
      try {
        onlineUsers = await User.countDocuments({
          lastSeen: { $gte: fifteenMinutesAgo }
        });
        console.log(`📊 Online users from User collection: ${onlineUsers}`);
      } catch (userError) {
        console.log("⚠️ User collection not found either, defaulting to 0");
        onlineUsers = 0;
      }
    }

    console.log(`📊 Dashboard stats - Total: ${totalCustomers}, Online: ${onlineUsers}`);

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

    const now = new Date();
    
    // Skapa en LoginEvent för att spåra aktivitet
    try {
      await LoginEvent.create({
        userId: userId,
        timestamp: now,
        ip: req.ip || '',
        device: req.headers['user-agent'] || ''
      });
      console.log(`📊 LoginEvent created for user ${userId}`);
    } catch (loginEventError) {
      console.log("⚠️ Could not create LoginEvent:", loginEventError.message);
    }

    // Uppdatera även User collection som fallback
    try {
      await User.findByIdAndUpdate(userId, {
        lastSeen: now,
        isOnline: isOnline !== false // Default till true om inte explicit false
      }, { upsert: true }); // Skapa användaren om den inte finns
      console.log(`📊 User status updated for user ${userId}`);
    } catch (userError) {
      console.log("⚠️ Could not update User collection:", userError.message);
    }

    res.json({ success: true, message: "Online-status uppdaterad" });
  } catch (err) {
    console.error("❌ Fel vid uppdatering av online-status:", err);
    res.status(500).json({ error: "Kunde inte uppdatera online-status" });
  }
});

module.exports = router;
