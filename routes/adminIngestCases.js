// routes/adminIngestCases.js
const express = require('express');
const crypto = require('crypto');
const Case = require('../models/Case');

const router = express.Router();

const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET;
if (!ADMIN_SHARED_SECRET) {
  console.warn('[INGEST CASES] ADMIN_SHARED_SECRET saknas i .env');
}

// OBS: Denna route förutsätter att server.js mountar express.raw() för denna path.
function verifySignature(raw, header) {
  if (!header || !header.startsWith('sha256=')) return false;
  const sent = header.slice(7);
  const calc = crypto.createHmac('sha256', ADMIN_SHARED_SECRET).update(raw).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sent, 'hex'), Buffer.from(calc, 'hex')); }
  catch { return false; }
}

// POST /admin/api/ingest/cases
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

    if (!payload?.sessionId) {
      return res.status(400).json({ success:false, error:'Missing sessionId' });
    }

    // Log incoming cases payload for debugging
    console.log('[INGEST CASES] Received payload:', {
      sessionId: payload.sessionId,
      customerId: payload.customerId,
      topic: payload.topic,
      description: payload.description,
      keys: Object.keys(payload)
    });

    // Process cases data
    const caseData = {
      sessionId: payload.sessionId,
      customerId: payload.customerId,
      topic: payload.topic,
      description: payload.description,
      status: payload.status || 'new',
      messages: payload.messages || [],
      createdAt: new Date()
    };

    // Log processed data
    console.log('[INGEST CASES] Processed as:', {
      sessionId: caseData.sessionId,
      customerId: caseData.customerId,
      topic: caseData.topic,
      status: caseData.status
    });
    
    // Upsert på sessionId (idempotent)
    await Case.updateOne(
      { sessionId: caseData.sessionId },
      { $setOnInsert: caseData },
      { upsert: true }
    );

    console.log('[INGEST CASES] Successfully saved case submission:', caseData.sessionId);

    // 200 OK med data
    return res.status(200).json({ 
      success: true, 
      message: 'Case submission received',
      sessionId: caseData.sessionId,
      status: caseData.status
    });
  } catch (e) {
    console.error('[INGEST CASES] error:', e);
    return res.status(500).json({ success:false, error:'Server error' });
  }
});

module.exports = router;
