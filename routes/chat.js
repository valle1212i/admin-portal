const express = require('express');
const router = express.Router();
const Message = require('../models/chat');
const Customer = require('../models/Customer'); // för namn & e-post i active-sessions

// 📨 POST - spara meddelande
router.post('/', async (req, res) => {
  try {
    const { customerId, sender, message, timestamp, sessionId } = req.body;

    if (!customerId || !sender || !message || !sessionId) {
      return res.status(400).json({ error: 'Obligatoriska fält saknas' });
    }

    const newMsg = await Message.create({
      customerId,
      sender,
      message,
      sessionId,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    res.status(201).json(newMsg);
  } catch (err) {
    console.error('❌ POST /api/chat fel:', err);
    res.status(500).json({ error: 'Kunde inte spara meddelande' });
  }
});

// 📥 GET - alla meddelanden för en specifik kund (valfri session)
router.get('/customer/:id', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    const filter = { customerId: req.params.id };
    if (sessionId) filter.sessionId = sessionId;

    const messages = await Message.find(filter).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error('❌ GET /api/chat/customer/:id fel:', err);
    res.status(500).json({ error: 'Kunde inte hämta meddelanden' });
  }
});

// 📊 GET - senaste meddelande från varje kund
router.get('/latest-by-customer', async (req, res) => {
  try {
    const latest = await Message.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$customerId",
          latestMessage: { $first: "$$ROOT" }
        }
      }
    ]);

    res.json(latest);
  } catch (err) {
    console.error('❌ GET /api/chat/latest-by-customer fel:', err);
    res.status(500).json({ error: 'Kunde inte hämta senaste meddelanden' });
  }
});

// 🗂 GET - hämta alla meddelanden
router.get('/all', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error("❌ GET /api/chat/all fel:", err);
    res.status(500).json({ error: "Kunde inte hämta alla meddelanden" });
  }
});

// 🔍 STEG 3: Aktiva chatt-sessioner
router.get('/active-sessions', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: -1 });

    const sessionsMap = new Map();

    for (const msg of messages) {
      const key = `${msg.customerId}-${msg.sessionId}`;
      if (!sessionsMap.has(key)) {
        sessionsMap.set(key, {
          customerId: msg.customerId,
          sessionId: msg.sessionId,
          lastMessage: msg.message,
          timestamp: msg.timestamp
        });
      }
    }

    const sessionList = await Promise.all(
      [...sessionsMap.values()].map(async (session) => {
        const customer = await Customer.findById(session.customerId);
        return {
          customerId: session.customerId,
          sessionId: session.sessionId,
          customerName: customer?.namn || "Okänd kund",
          customerEmail: customer?.email || "-",
          lastMessage: session.lastMessage,
          timestamp: session.timestamp
        };
      })
    );

    res.json(sessionList);
  } catch (err) {
    console.error("❌ GET /api/chat/active-sessions fel:", err);
    res.status(500).json({ error: "Kunde inte hämta aktiva sessioner" });
  }
});

module.exports = router;
