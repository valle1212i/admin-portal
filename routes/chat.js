const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// Hämta alla meddelanden för en specifik kund
router.get("/customer/:customerId", async (req, res) => {
  try {
    const messages = await Message.find({ customerId: req.params.customerId });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Fel vid hämtning av meddelanden" });
  }
});

// Skicka ett nytt meddelande
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

module.exports = router;
