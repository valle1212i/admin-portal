// routes/adminIngestAIStudio.js
const express = require('express');
const crypto = require('crypto');
const Ad = require('../models/Ad');

const router = express.Router();

const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET;
if (!ADMIN_SHARED_SECRET) {
  console.warn('[INGEST AI STUDIO] ADMIN_SHARED_SECRET saknas i .env');
}

// OBS: Denna route förutsätter att server.js mountar express.raw() för denna path.
function verifySignature(raw, header) {
  if (!header || !header.startsWith('sha256=')) return false;
  const sent = header.slice(7);
  const calc = crypto.createHmac('sha256', ADMIN_SHARED_SECRET).update(raw).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sent, 'hex'), Buffer.from(calc, 'hex')); }
  catch { return false; }
}

// POST /admin/api/ingest/ai-studio
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

    // Log incoming AI Studio payload for debugging
    console.log('[INGEST AI STUDIO] Received payload:', {
      idempotencyKey: payload.idempotencyKey,
      tenantId: payload.tenantId,
      type: payload.type,
      hasImageUrl: !!payload.imageUrl,
      hasPdfUrl: !!payload.pdfUrl,
      hasPrompt: !!payload.prompt,
      keys: Object.keys(payload)
    });

    // Process AI Studio data
    const aiStudioPayload = {
      ...payload,
      category: 'ai-studio',
      aiStudioData: {
        generatedImages: payload.imageUrl ? [payload.imageUrl] : [],
        generatedPDFs: payload.pdfUrl ? [payload.pdfUrl] : [],
        generationType: payload.generationType || 'artwork',
        prompt: payload.prompt || 'AI Studio generation'
      }
    };

    // Log processed data
    console.log('[INGEST AI STUDIO] Processed as:', {
      category: aiStudioPayload.category,
      generationType: aiStudioPayload.aiStudioData.generationType,
      imagesCount: aiStudioPayload.aiStudioData.generatedImages.length,
      pdfsCount: aiStudioPayload.aiStudioData.generatedPDFs.length
    });
    
    // Upsert på idempotencyKey (idempotent)
    await Ad.updateOne(
      { idempotencyKey: aiStudioPayload.idempotencyKey },
      { $setOnInsert: aiStudioPayload },
      { upsert: true }
    );

    console.log('[INGEST AI STUDIO] Successfully saved AI Studio submission:', aiStudioPayload.idempotencyKey);

    // 200 OK med data (inte 204 som ads)
    return res.status(200).json({ 
      success: true, 
      message: 'AI Studio submission received',
      idempotencyKey: aiStudioPayload.idempotencyKey,
      category: aiStudioPayload.category
    });
  } catch (e) {
    console.error('[INGEST AI STUDIO] error:', e);
    return res.status(500).json({ success:false, error:'Server error' });
  }
});

module.exports = router;
