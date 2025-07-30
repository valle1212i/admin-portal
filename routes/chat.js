const express = require("express");
const router = express.Router();
const Case = require("../models/Case");
const Customer = require("../models/Customer");

// 📨 Hämta alla meddelanden för en specifik kund och session
router.get("/customer/:customerId", async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ message: "sessionId krävs" });
  }

  try {
    const caseDoc = await Case.findOne({ customerId: req.params.customerId, sessionId });
    if (!caseDoc) return res.status(404).json([]);

    res.json(caseDoc.messages || []);
  } catch (err) {
    console.error("❌ Fel vid hämtning av meddelanden:", err);
    res.status(500).json({ message: "Fel vid hämtning av meddelanden" });
  }
});

// ✉️ Spara ett nytt meddelande till rätt case
router.post("/", async (req, res) => {
  try {
    const { sessionId, customerId, message, sender } = req.body;
    if (!sessionId || !customerId || !message || !sender) {
      return res.status(400).json({ success: false, message: "Ofullständig data" });
    }

    const caseDoc = await Case.findOne({ sessionId });
    if (!caseDoc) {
      return res.status(404).json({ success: false, message: "Case ej hittad" });
    }

    caseDoc.messages.push({
      sender,
      message,
      timestamp: new Date()
    });

    await caseDoc.save();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("❌ Fel vid sparande av meddelande:", err);
    res.status(500).json({ success: false });
  }
});

// 🔍 Visa senaste aktiva chatsessioner
router.get("/active-sessions", async (req, res) => {
  try {
    const cases = await Case.find({})
      .sort({ createdAt: -1 })
      .limit(20);

    const populated = await Promise.all(
      cases.map(async (c) => {
        const customer = await Customer.findById(c.customerId);
        return {
          sessionId: c.sessionId,
          customerId: c.customerId,
          timestamp: c.createdAt,
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
