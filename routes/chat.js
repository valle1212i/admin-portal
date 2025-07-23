const express = require('express');
const router = express.Router();
const Message = require('../models/chat');
const Customer = require('../models/Customer');
const Case = require('../models/Case'); // 🆕 för arkivering

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

// 🔍 Aktiva chatt-sessioner (senaste 1h)
router.get('/active-sessions', async (req, res) => {
  try {
    const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
    const messages = await Message.find({ timestamp: { $gte: ONE_HOUR_AGO } }).sort({ timestamp: -1 });

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
          customerName: customer?.namn || customer?.name || "Okänd kund",
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

// 🗃️ Flytta gamla sessioner till Cases & Contacts
router.post("/archive-old", async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const expiredSessions = await Message.aggregate([
      { $match: { timestamp: { $lt: oneHourAgo } } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: { customerId: "$customerId", sessionId: "$sessionId" },
          messages: { $push: "$$ROOT" }
        }
      }
    ]);

    for (const session of expiredSessions) {
      const alreadyArchived = await Case.findOne({
        customerId: session._id.customerId,
        sessionId: session._id.sessionId
      });

      if (!alreadyArchived) {
        await Case.create({
          customerId: session._id.customerId,
          sessionId: session._id.sessionId,
          messages: session.messages
        });

        // Valfritt: rensa från meddelandetabellen om du vill
        // await Message.deleteMany({
        //   customerId: session._id.customerId,
        //   sessionId: session._id.sessionId
        // });
      }
    }

    res.json({ message: `Flyttade ${expiredSessions.length} sessioner till Cases.` });
  } catch (err) {
    console.error("❌ POST /api/chat/archive-old fel:", err);
    res.status(500).json({ error: "Kunde inte arkivera sessioner" });
  }
});

module.exports = router;
