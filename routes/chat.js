const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Customer = require("../models/Customer");

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

// 🔍 Hämta aktiva chatt-sessioner (senaste per sessionId)
router.get("/active-sessions", async (req, res) => {
  try {
    const recentMessages = await Message.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$sessionId",
          customerId: { $first: "$customerId" },
          timestamp: { $first: "$timestamp" }
        }
      },
      { $sort: { timestamp: -1 } },
      { $limit: 20 }
    ]);

    const populated = await Promise.all(
      recentMessages.map(async (msg) => {
        const customer = await Customer.findById(msg.customerId);
        return {
          sessionId: msg._id,
          customerId: msg.customerId,
          timestamp: msg.timestamp,
          customerName: customer?.name || "Okänd"
        };
      })
    );

    res.json(populated);
  } catch (err) {
    console.error("❌ Fel vid hämtning av aktiva sessioner:", err);
    res.status(500).json({ message: "Fel vid hämtning av aktiva sessioner" });
  }
});

module.exports = router;
