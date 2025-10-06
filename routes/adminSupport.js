// routes/adminSupport.js
const express = require('express');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const router = express.Router();


console.log('🟢 routes/adminSupport.js laddad');
router.get('/ping', (_req, res) => res.json({ ok: true, route: 'support' }));

const requireAdminLogin = require('../middleware/requireAdminLogin');
const Case = require('../models/Case');
const Customer = require('../models/Customer');

// Hjälpmetoder
function toDate(val){ try { return val ? new Date(val) : null; } catch { return null; } }
function safeStr(x){ return (x ?? '').toString(); }

// GET /api/admin/support
// Query: q, status(open|closed), from, to, page, limit
router.get('/', requireAdminLogin, async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '200', 10), 1), 500);

    const q       = (req.query.q || '').trim();
    const statusQ = (req.query.status || '').trim().toLowerCase();
    const from    = toDate(req.query.from);
    const to      = toDate(req.query.to);

    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = from;
      if (to)   match.createdAt.$lte = to;
    }

    // Grundhämtning
    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ];

    const [itemsRaw, total] = await Promise.all([
      Case.aggregate(pipeline),
      Case.countDocuments(match)
    ]);

    // Hämta ev. kundemails
    const customerIds = itemsRaw.map(c => c.customerId).filter(Boolean);
    const customers = customerIds.length
      ? await Customer.find({ _id: { $in: customerIds } }, { email: 1 }).lean()
      : [];
    const emailById = new Map(customers.map(c => [safeStr(c._id), c.email]));

    // Forma svar för UI
    const items = itemsRaw
      .map(c => {
        const latestMsg = (c.messages || []).slice(-1)[0] || null;
        const closed = !!(c.closedAt || (typeof c.status === 'string' && c.status.toLowerCase() === 'closed'));
        const status = closed ? 'closed' : 'open';

        // fritextsökning q
        const hay = [
          c.topic, c.description,
          ...(c.tags || []),
          emailById.get(safeStr(c.customerId)) || '',
          latestMsg?.message || ''
        ].join(' ').toLowerCase();

        if (q && !hay.includes(q.toLowerCase())) return null;
        if (statusQ && status !== statusQ) return null;

        return {
          id: c._id,
          status,
          customerEmail: emailById.get(safeStr(c.customerId)) || null,
          createdAt: c.createdAt || c.timestamp || null,
          message: latestMsg?.message || c.description || '',
          tags: Array.isArray(c.tags) ? c.tags : []
        };
      })
      .filter(Boolean);

    res.json({ page, limit, total, items });
  } catch (err) {
    console.error('❌ /api/admin/support fel:', err);
    res.status(500).json({ error: 'Internt serverfel' });
  }
});

module.exports = router;
