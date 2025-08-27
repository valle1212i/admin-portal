// routes/messagesRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('./security');
const Broadcast = require('../models/Broadcast');
const Customer = require('../models/Customer');

// 🔒 Kundens egen inbox (visas i kunder.html)
router.get('/latest', requireAuth, async (req, res) => {
  try {
    const customerId = req.session.user._id;

    const items = await Broadcast.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // forma payload som din frontend förväntar sig
    const customerName = req.session.user.name || 'Kund';

    const out = items.map(x => ({
      customerName,
      subject: x.subject,
      message: x.text || x.html?.replace(/<[^>]*>/g, '').slice(0, 300) || '',
      date: x.createdAt,
      fromName: x.fromName || 'Source Team',
    }));

    res.json(out);
  } catch (err) {
    console.error('GET /api/messages/latest error:', err);
    res.status(500).json([]);
  }
});

// (valfritt) Markera som läst
router.post('/mark-read', requireAuth, async (req, res) => {
  try {
    const customerId = req.session.user._id;
    const { ids = [] } = req.body || {};
    await Broadcast.updateMany({ _id: { $in: ids }, customerId }, { $set: { readAt: new Date() } });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/messages/mark-read error:', err);
    res.status(500).json({ success: false });
  }
});

// 🔐 Admin: skapa broadcast manuellt (om du vill skicka utan mejl)
router.post('/broadcast', async (req, res, next) => {
  // enkel admin-koll via session (eller importera requireAdmin om du har det)
  if (req.session?.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Åtkomst nekad' });
  }
  next();
}, async (req, res) => {
  try {
    const { subject, html = '', text = '', customerIds = [] } = req.body || {};
    if (!subject || (!html && !text)) {
      return res.status(400).json({ success: false, message: 'subject + html/text krävs' });
    }
    if (!customerIds.length) {
      return res.status(400).json({ success: false, message: 'customerIds krävs' });
    }

    const docs = customerIds.map(id => ({
      customerId: id,
      subject,
      html,
      text,
      fromName: 'Source Team',
    }));

    await Broadcast.insertMany(docs);
    res.json({ success: true, count: docs.length });
  } catch (err) {
    console.error('POST /api/messages/broadcast error:', err);
    res.status(500).json({ success: false, message: 'Serverfel' });
  }
});

module.exports = router;
