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
          status: c.status,
          createdAt: c.createdAt,
          assignedAdmin: c.assignedAdmin,
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

// ✅ NY: Hämta alla ärenden för en specifik kund
router.get("/customer/:customerId", async (req, res) => {
  const { customerId } = req.params;

  try {
    const cases = await Case.find({ customerId }).sort({ createdAt: -1 }).lean();
    res.json(cases);
  } catch (err) {
    console.error("❌ Fel vid hämtning av ärenden för kund:", err);
    res.status(500).json({ message: "Fel vid hämtning av ärenden" });
  }
});

// 🧾 Hämta metadata för ett ärende via sessionId
router.get("/meta/:sessionId", async (req, res) => {
  try {
    const caseDoc = await Case.findOne({ sessionId: req.params.sessionId }).lean();
    if (!caseDoc) {
      return res.status(404).json({ message: "Case saknas" });
    }

    const customer = await Customer.findById(caseDoc.customerId).lean();

    res.json({
      _id: caseDoc._id,
      sessionId: caseDoc.sessionId,
      customerId: caseDoc.customerId,
      topic: caseDoc.topic,
      description: caseDoc.description,
      status: caseDoc.status,
      assignedAdmin: caseDoc.assignedAdmin,
      messages: caseDoc.messages,
      internalNotes: caseDoc.internalNotes || [],
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

// 🔁 Uppdatera status för ett ärende
router.post("/update-status", async (req, res) => {
  const { sessionId, status } = req.body;

  if (!sessionId || !status) {
    return res.status(400).json({ success: false, message: "sessionId och status krävs." });
  }

  try {
    const updated = await Case.findOneAndUpdate(
      { sessionId },
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Ärende ej hittat." });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fel vid uppdatering av status:", err);
    res.status(500).json({ success: false });
  }
});

// 📝 Lägg till intern anteckning
router.post("/add-note", async (req, res) => {
  const { sessionId, note } = req.body;

  if (!sessionId || !note) {
    return res.status(400).json({ success: false, message: "sessionId och note krävs." });
  }

  try {
    const updated = await Case.findOneAndUpdate(
      { sessionId },
      { $push: { internalNotes: { note, timestamp: new Date() } } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Ärende ej hittat." });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fel vid sparande av anteckning:", err);
    res.status(500).json({ success: false });
  }
});

// 💬 Skicka meddelande till kund (lägg till i messages och uppdatera kundens supporthistorik)
router.post("/send-message", async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ success: false, message: "sessionId och message krävs." });
  }

  try {
    const msg = {
      sender: "admin",
      message,
      timestamp: new Date()
    };

    const caseDoc = await Case.findOneAndUpdate(
      { sessionId },
      { $push: { messages: msg } },
      { new: true }
    );

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: "Ärende ej hittat." });
    }

    // OBS! Lägg till denna rad – saknades:
    const customerId = caseDoc.customerId;

    const supportItem = {
      caseId: caseDoc._id.toString(),
      topic: caseDoc.topic || "Okänt ärende",
      date: new Date(),
      status: caseDoc.status || "Pågående"
    };

    await Customer.findByIdAndUpdate(
      customerId,
      { $push: { supportHistory: supportItem } },
      { new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fel vid skickande av meddelande:", err);
    res.status(500).json({ success: false });
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
