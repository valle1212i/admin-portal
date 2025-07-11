const express = require('express');
const router = express.Router();
const Message = require('../models/chat');

// 📨 POST - spara meddelande
router.post('/', async (req, res) => {
  try {
    const { customerId, sender, message, timestamp } = req.body;

    if (!customerId || !sender || !message) {
      return res.status(400).json({ error: 'Obligatoriska fält saknas' });
    }

    const newMsg = await Message.create({
      customerId,
      sender,
      message,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    res.status(201).json(newMsg);
  } catch (err) {
    console.error('❌ POST /api/chat fel:', err);
    res.status(500).json({ error: 'Kunde inte spara meddelande' });
  }
});

// 📥 GET - alla meddelanden för en specifik kund
router.get('/customer/:id', async (req, res) => {
  try {
    const messages = await Message.find({ customerId: req.params.id }).sort({ timestamp: 1 });
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
// 🗂 GET - hämta alla meddelanden (för felsökning eller admin)
router.get('/all', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error("❌ GET /api/chat/all fel:", err);
    res.status(500).json({ error: "Kunde inte hämta alla meddelanden" });
  }
});


module.exports = router;
