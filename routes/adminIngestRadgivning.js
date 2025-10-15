// routes/adminIngestRadgivning.js
const express = require('express');
const crypto = require('crypto');
const Ad = require('../models/Ad');

const router = express.Router();

const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET;
if (!ADMIN_SHARED_SECRET) {
  console.warn('[INGEST RADGIVNING] ADMIN_SHARED_SECRET saknas i .env');
}

// OBS: Denna route förutsätter att server.js mountar express.raw() för just denna path.
function verifySignature(raw, header) {
  if (!header || !header.startsWith('sha256=')) return false;
  const sent = header.slice(7);
  const calc = crypto.createHmac('sha256', ADMIN_SHARED_SECRET).update(raw).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sent, 'hex'), Buffer.from(calc, 'hex')); }
  catch { return false; }
}

// POST /admin/api/ingest/radgivning
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

    // Log incoming rådgivning payload for debugging
    console.log('[INGEST RADGIVNING] Received payload:', {
      idempotencyKey: payload.idempotencyKey,
      tenantId: payload.tenantId,
      type: payload.type,
      hasMessage: !!payload.data?.message,
      hasPrimaryGoal: !!payload.data?.primaryGoal,
      hasDesignStrategy: !!payload.data?.designStrategy,
      keys: Object.keys(payload)
    });

    // Process rådgivning data
    const radgivningPayload = {
      ...payload,
      category: 'radgivning',
      radgivningData: {
        questions: [
          { question: 'Meddelande', answer: payload.data?.message || '' },
          { question: 'Primärt mål', answer: payload.data?.primaryGoal || '' },
          { question: 'Designstrategi', answer: payload.data?.designStrategy || '' },
          { question: 'Pågående support', answer: payload.data?.ongoingSupport || '' },
          { question: 'AI Media hjälp', answer: payload.data?.aiMediaHelp || '' },
          { question: 'Extra information', answer: payload.data?.extra || '' }
        ].filter(q => q.answer.trim()),
        sessionId: payload.sessionId,
        priority: payload.meta?.priority || 'medium'
      }
    };

    // Log processed data
    console.log('[INGEST RADGIVNING] Processed as:', {
      category: radgivningPayload.category,
      questionsCount: radgivningPayload.radgivningData.questions.length,
      priority: radgivningPayload.radgivningData.priority
    });
    
    // Upsert på idempotencyKey (idempotent)
    await Ad.updateOne(
      { idempotencyKey: radgivningPayload.idempotencyKey },
      { $setOnInsert: radgivningPayload },
      { upsert: true }
    );

    console.log('[INGEST RADGIVNING] Successfully saved rådgivning submission:', radgivningPayload.idempotencyKey);

    // 200 OK med data (inte 204 som ads)
    return res.status(200).json({ 
      success: true, 
      message: 'Rådgivning submission received',
      idempotencyKey: radgivningPayload.idempotencyKey,
      category: radgivningPayload.category
    });
  } catch (e) {
    console.error('[INGEST RADGIVNING] error:', e);
    return res.status(500).json({ success:false, error:'Server error' });
  }
});

module.exports = router;
