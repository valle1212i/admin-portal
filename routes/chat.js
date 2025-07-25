const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// 📨 Hämta alla meddelanden för en specifik kund och session
router.get("/customer/:customerId", async (req, res) => {
  const { sessionId } = req.query;

  try {
    const query = { customerId: req.params.customerId };
    if (sessionId) query.sessionId = sessionId;

    const messages = await Message.find(query).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error("❌ Fel vid hämtning av meddelanden:", err);
    res.status(500).json({ message: "Fel vid hämtning av meddelanden" });
  }
});

// ✉️ Skapa och spara ett nytt meddelande
router.post("/", async (req, res) => {
  try {
    const newMessage = new Message(req.body);
    await newMessage.save();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("❌ Fel vid sparande av meddelande:", err);
    res.status(500).json({ success: false });
  }
});

// 🔍 Hämta aktiva chatt-sessioner
router.get("/active-sessions", async (req, res) => {
  try {
    // Hämta alla meddelanden från senaste 2 timmarna
    const since = new Date(Date.now() - 1000 * 60 * 60 * 2); // 2 timmar bakåt

    const recentMessages = await Message.find({ timestamp: { $gte: since } });

    // Grupp: customerId + sessionId → senast meddelande
    const sessionsMap = {};

    recentMessages.forEach(msg => {
      const key = `${msg.customerId}_${msg.sessionId}`;
      if (!sessionsMap[key] || msg.timestamp > sessionsMap[key].timestamp) {
        sessionsMap[key] = {
          customerId: msg.customerId,
          sessionId: msg.sessionId,
          customerName: msg.sender === "customer" ? msg.senderName || "Kund" : null,
          timestamp: msg.timestamp
        };
      }
    });

    const sessions = Object.values(sessionsMap);
    res.json(sessions);
  } catch (err) {
    console.error("❌ Fel vid hämtning av aktiva sessioner:", err);
    res.status(500).json({ message: "Fel vid hämtning av aktiva sessioner" });
  }
});

module.exports = router;
