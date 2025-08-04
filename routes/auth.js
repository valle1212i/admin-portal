const express = require('express');
const router = express.Router();
const AdminUser = require('../models/Admin');
const bcrypt = require('bcrypt');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await AdminUser.findOne({ email });

    if (!user) {
      return res.status(401).json({ success: false, message: '❌ Fel e-post eller lösenord' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: '❌ Fel e-post eller lösenord' });
    }

    // 🕒 Lägg till loginTimestamp i databasen
    user.loginTimestamps = user.loginTimestamps || [];
    user.loginTimestamps.push(new Date());
    await user.save();

    // 🧠 Lägg admin i session
    req.session.admin = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "admin",
      loginTime: Date.now()
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
