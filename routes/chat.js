const express = require("express");
const router = express.Router();
const Case = require("../models/Case");
const Customer = require("../models/Customer");

// 📨 Hämta alla meddelanden för en specifik kund och session
router.get("/active-sessions", async (req, res) => {
  try {
    const cases = await Case.find().sort({ createdAt: -1 }).limit(20).lean();

    const populated = await Promise.all(
      cases.map(async (caseDoc) => {
        const customer = await Customer.findById(caseDoc.customerId);
        const lastMessage = caseDoc.messages[caseDoc.messages.length - 1];
        return {
          sessionId: caseDoc.sessionId,
          customerId: caseDoc.customerId,
          timestamp: lastMessage?.timestamp || caseDoc.createdAt,
          customerName: customer?.name || "Okänd"
        };
      })
    );

    res.json(populated);
  } catch (err) {
    console.error("❌ Fel vid hämtning av aktiva case-sessioner:", err);
    res.status(500).json({ message: "Fel vid hämtning av aktiva sessioner" });
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


module.exports = router;
