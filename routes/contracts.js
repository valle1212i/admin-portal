const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Contract = require('../models/Contract');
const Customer = require('../models/Customer');

// 📂 Lagring av avtal
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'public', 'contracts');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// 📥 Ladda upp nytt avtal
router.post('/upload', upload.single('contractFile'), async (req, res) => {
  try {
    const { customerId, status } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "Ingen fil uppladdad" });

    const fileUrl = '/contracts/' + req.file.filename;

    const newContract = await Contract.create({
      customerId,
      filename: req.file.originalname,
      fileUrl,
      status
    });

    res.json({ success: true, contract: newContract });
  } catch (err) {
    console.error("❌ Fel vid uppladdning av avtal:", err);
    res.status(500).json({ success: false, message: "Serverfel vid uppladdning" });
  }
});

// 📤 Hämta alla avtal
router.get('/', async (req, res) => {
  try {
    const contracts = await Contract.find().populate('customerId', 'name email').sort({ uploadedAt: -1 });

    const formatted = contracts.map(c => ({
      _id: c._id,
      customerName: c.customerId?.name || "Okänd",
      filename: c.filename,
      status: c.status,
      uploadedAt: c.uploadedAt,
      fileUrl: c.fileUrl
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Fel vid hämtning av avtal:", err);
    res.status(500).json({ success: false, message: "Kunde inte hämta avtal" });
  }
});

// 📤 Hämta alla avtal för en specifik kund
router.get('/:customerId', async (req, res) => {
    try {
      const { customerId } = req.params;
      const contracts = await Contract.find({ customerId })
        .sort({ uploadedAt: -1 });
  
      res.json({
        success: true,
        contracts: contracts.map(c => ({
          _id: c._id,
          filename: c.filename,
          status: c.status,
          uploadedAt: c.uploadedAt,
          fileUrl: c.fileUrl
        }))
      });
    } catch (err) {
      console.error("❌ Fel vid hämtning av kundens avtal:", err);
      res.status(500).json({ success: false, message: "Kunde inte hämta kundens avtal" });
    }
  });
  

module.exports = router;
