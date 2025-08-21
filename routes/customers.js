const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// 🔗 Skapa separat MongoDB-koppling till kundportalen
const customerConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  dbName: "kundportal",
});

// 🧱 Definiera Customer-modellen
const Customer = customerConnection.model(
  "Customer",
  new mongoose.Schema({}, { strict: false })
);

// 🔁 Hämta alla kunder (simulerad)
router.get("/", (req, res) => {
  res.json({ message: "Hämtar alla kunder (simulerat)" });
});

// ➕ POST – skapa kund
router.post("/", (req, res) => {
  const newCustomer = req.body;
  res.status(201).json({ message: "Ny kund skapad", data: newCustomer });
});

// 🔄 Hämta senaste kund
router.get("/latest", async (req, res) => {
  try {
    const latestCustomer = await Customer.findOne().sort({ createdAt: -1 });
    console.log("Senaste kund:", latestCustomer);
    res.json(latestCustomer);
  } catch (err) {
    console.error("Fel vid hämtning:", err);
    res.status(500).json({ error: "Kunde inte hämta kunddata" });
  }
});

// 🔍 Sök kund
router.get("/search", async (req, res) => {
  const query = req.query.q;

  try {
    const kunder = await Customer.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    });
    res.json(kunder);
  } catch (err) {
    console.error("Fel vid sökning:", err);
    res.status(500).json({ error: "Kunde inte söka kunder" });
  }
});

// 📋 Hämta alla kunder
router.get("/all", async (req, res) => {
  try {
    const kunder = await Customer.find({});
    res.json(kunder);
  } catch (err) {
    console.error("Fel vid hämtning av kunder:", err);
    res.status(500).json({ error: "Kunde inte hämta kunder" });
  }
});

// 📄 Hämta en enskild kund via ID
router.get("/by-id/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const kund = await Customer.findById(id);
    if (!kund) return res.status(404).send("Kund hittades inte");
    res.json(kund);
  } catch (err) {
    console.error("Fel vid hämtning av kund:", err);
    res.status(500).json({ error: "Kunde inte hämta kund" });
  }
});

// ✅ GET: Hämta marknadsföringsval för en specifik kund
router.get("/:id/marketing", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();

    if (!customer) {
      return res.status(404).json({ error: "Kund hittades inte" });
    }

    res.json(customer.marketingData || {});
  } catch (err) {
    console.error("❌ Fel vid hämtning av marknadsföringsdata:", err);
    res.status(500).json({ error: "Serverfel vid hämtning" });
  }
});

// ✅ NY: Hämta alla kunder med marknadsföringsdata
router.get("/marketing-submissions", async (req, res) => {
  try {
    const kunder = await Customer.find({
      $or: [
        { "marketing.googleAds": { $exists: true } },
        { "marketing.metaAds": { $exists: true } },
        { "marketing.tiktokAds": { $exists: true } },
        { "marketing.linkedinAds": { $exists: true } }
      ]
    });

    res.json(kunder);
  } catch (err) {
    console.error("❌ Fel vid hämtning av marknadsföringsansökningar:", err);
    res.status(500).json({ error: "Kunde inte hämta marknadsföringsdata" });
  }
});
// Minimal kundlista för dropdown i avtal (endast admin)
const { requireAuth } = require('./security');

router.get('/all-basic', requireAuth, async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Åtkomst nekad' });
    }

    const customers = await Customer.find({}, { name: 1, email: 1 }).sort({ name: 1 }).lean();
    res.json(customers);
  } catch (err) {
    console.error('❌ /api/customers/all-basic fel:', err);
    res.status(500).json({ success: false, message: 'Serverfel' });
  }
});

module.exports = router;
