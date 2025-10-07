// routes/adminIngestAds.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Ad = require('../models/Ad'); // <- den admin-modell jag gav dig tidigare

const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET;
if (!ADMIN_SHARED_SECRET) {
  console.warn('[INGEST] ADMIN_SHARED_SECRET saknas i .env');
}

// OBS: Denna route förutsätter att server.js mountar express.raw() för just denna path.
// Se server.js-snippet längre ner.
function verifySignature(raw, header) {
  if (!header || !header.startsWith('sha256=')) return false;
  const sent = header.slice(7);
  const calc = crypto.createHmac('sha256', ADMIN_SHARED_SECRET).update(raw).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sent, 'hex'), Buffer.from(calc, 'hex')); }
  catch { return false; }
}

// POST /admin/api/ingest/ads
router.post('/', async (req, res) => {
  try {
    // req.body är en Buffer eftersom vi mountar express.raw() för denna path
    const raw = req.body;
    if (!Buffer.isBuffer(raw) || raw.length === 0) {
      return res.status(400).json({ success:false, error:'Empty body' });
    }

    const ok = verifySignature(raw, req.get('x-signature'));
    if (!ok) return res.status(401).json({ success:false, error:'Invalid signature' });

    let payload;
    try { payload = JSON.parse(raw.toString('utf8')); }
    catch { return res.status(400).json({ success:false, error:'Bad JSON' }); }

    if (!payload?.idempotencyKey) {
      return res.status(400).json({ success:false, error:'Missing idempotencyKey' });
    }

    // Upsert på idempotencyKey (idempotent)
    await Ad.updateOne(
      { idempotencyKey: payload.idempotencyKey },
      { $setOnInsert: payload },
      { upsert: true }
    );

    // 204 = No Content (inget behov att skicka något tillbaka)
    return res.status(204).end();
  } catch (e) {
    console.error('[INGEST] error:', e);
    return res.status(500).json({ success:false, error:'Server error' });
  }
});

module.exports = router;
