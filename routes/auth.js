const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const bcrypt = require('bcrypt');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await Customer.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: '❌ Fel e-post eller lösenord' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: '❌ Fel e-post eller lösenord' });
    }

    // Här borde du sätta en session eller token om det behövs
    res.status(200).json({ success: true, message: '✅ Inloggning lyckades!' });

  } catch (err) {
    console.error("❌ Fel vid inloggning:", err);
    res.status(500).json({ success: false, message: '❌ Serverfel vid inloggning.' });
  }
});

module.exports = router;
