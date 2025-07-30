const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// 🔗 Skapa separat MongoDB-koppling till kundportalen
const customerConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
    dbName: "kundportal", // 
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
// SÖK: hämta kunder baserat på sökord i namn eller e-post
router.get("/search", async (req, res) => {
    const query = req.query.q;
  
    try {
      const kunder = await Customer.find({
        $or: [
            { name: { $regex: query, $options: "i" } },
            { email: { $regex: query, $options: "i" } }
          ]          
      });
      res.json(kunder);
    } catch (err) {
      console.error("Fel vid sökning:", err);
      res.status(500).json({ error: "Kunde inte söka kunder" });
    }
  });
  // Hämta alla kunder
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
  
      // Om du använder en vy (t.ex. admin-customer.html via res.render)
      // res.render("admin-customer", { kund });
  
      // Om du vill skicka JSON (används i frontend som fetch)
      res.json(kund);
    } catch (err) {
      console.error("Fel vid hämtning av kund:", err);
      res.status(500).json({ error: "Kunde inte hämta kund" });
    }
  });
  
  
  module.exports = router;
  