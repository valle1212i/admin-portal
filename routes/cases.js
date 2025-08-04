const express = require("express");
const router = express.Router();
const Case = require("../models/Case");
const Customer = require("../models/Customer");

// 📂 Hämta alla supportärenden
router.get("/", async (req, res) => {
  try {
    const cases = await Case.find().sort({ createdAt: -1 }).lean();

    const populated = await Promise.all(
      cases.map(async (c) => {
        const customer = await Customer.findById(c.customerId).lean();
        return {
          caseId: c._id,
          sessionId: c.sessionId,
          customerId: c.customerId,
          topic: c.topic,
          description: c.description,
          createdAt: c.createdAt,
          customerName: customer?.name || "Okänd"
        };
      })
    );

    res.json(populated);
  } catch (err) {
    console.error("❌ Kunde inte hämta cases:", err);
    res.status(500).json({ message: "Fel vid hämtning av ärenden" });
  }
});

// 🧾 Hämta metadata för ett ärende via sessionId (MÅSTE komma före /:id!)
router.get("/meta/:sessionId", async (req, res) => {
  try {
    const caseDoc = await Case.findOne({ sessionId: req.params.sessionId }).lean();
    if (!caseDoc) {
      return res.status(404).json({ message: "Case saknas" });
    }

    const customer = await Customer.findById(caseDoc.customerId).lean();

    res.json({
      sessionId: caseDoc.sessionId,
      customerId: caseDoc.customerId,
      topic: caseDoc.topic,
      description: caseDoc.description,
      createdAt: caseDoc.createdAt,
      customerName: customer?.name || "Okänd"
    });
  } catch (err) {
    console.error("❌ Fel vid hämtning av case-meta:", err);
    res.status(500).json({ message: "Serverfel" });
  }
});

// 🔁 Uppdatera ansvarig admin för ett ärende via sessionId
router.post("/assign-admin", async (req, res) => {
    try {
      const { sessionId, adminId } = req.body;
  
      if (!sessionId || !adminId) {
        return res.status(400).json({ success: false, message: "sessionId och adminId krävs" });
      }
  
      const updated = await Case.findOneAndUpdate(
        { sessionId },
        { assignedAdmin: adminId },
        { new: true }
      );
  
      if (!updated) {
        return res.status(404).json({ success: false, message: "Ärendet kunde inte hittas" });
      }
  
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Kunde inte uppdatera ansvarig admin:", err);
      res.status(500).json({ success: false, message: "Serverfel vid uppdatering" });
    }
  });
  

// 🧾 Hämta ett ärende via dess MongoDB _id (LÄGG DENNA SIST!)
router.get("/:id", async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id).lean();
    if (!caseDoc) {
      return res.status(404).json({ message: "Ärende hittades inte" });
    }

    const customer = await Customer.findById(caseDoc.customerId).lean();

    res.json({
      ...caseDoc,
      customerName: customer?.name || "Okänd"
    });
  } catch (err) {
    console.error("❌ Kunde inte hämta ärendet:", err);
    res.status(500).json({ message: "Fel vid hämtning av ärendet" });
  }
});

module.exports = router;
