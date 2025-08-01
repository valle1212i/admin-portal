const express = require("express");
const router = express.Router();
const Case = require("../models/Case");
const Customer = require("../models/Customer");

// 📂 Hämta alla supportärenden (för t.ex. admin cases.html)
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

// 🧾 Hämta enskilt ärende (för t.ex. case-detail.html)
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
