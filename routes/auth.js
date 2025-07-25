const express = require('express');
const router = express.Router();
const AdminUser = require('../models/Admin'); // Se till att din model heter Admin.js
const bcrypt = require('bcrypt');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // ✅ Hämta användare med korrekt model
    const user = await AdminUser.findOne({ email });

    if (!user) {
      return res.status(401).json({ success: false, message: '❌ Fel e-post eller lösenord' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: '❌ Fel e-post eller lösenord' });
    }

    // 🧠 Spara admin i sessionen
    req.session.admin = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "admin"
    };

    res.status(200).json({
      success: true,
      message: '✅ Inloggning lyckades!',
      admin: req.session.admin
    });

  } catch (err) {
    console.error("❌ Fel vid inloggning:", err);
    res.status(500).json({ success: false, message: '❌ Serverfel vid inloggning.' });
  }
});

module.exports = router;
