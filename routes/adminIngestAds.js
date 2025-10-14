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

// NEW: Categorization function
function categorizeSubmission(payload) {
  const categorized = { ...payload };
  
  // Check for AI Studio indicators (based on customer portal logs)
  if (payload.type === 'ai-studio' || 
      payload.meta?.type === 'ai-studio' ||
      payload.meta?.source === 'ai-studio' || 
      payload.imageUrl ||
      payload.pdfUrl ||
      payload.answers?.imageUrl ||
      payload.answers?.pdfUrl ||
      payload.answers?.generationType ||
      payload.meta?.generationType) {
    categorized.category = 'ai-studio';
    categorized.aiStudioData = {
      generatedImages: payload.imageUrl ? [payload.imageUrl] : (payload.answers?.imageUrl ? [payload.answers.imageUrl] : []),
      generatedPDFs: payload.pdfUrl ? [payload.pdfUrl] : (payload.answers?.pdfUrl ? [payload.answers.pdfUrl] : []),
      generationType: payload.answers?.generationType || payload.meta?.generationType || 'artwork',
      prompt: payload.answers?.prompt || payload.extraInfo || payload.meta?.prompt || 'AI Studio generation'
    };
  }
  // Check for Rådgivning indicators (based on customer portal logs)
  else if (payload.type === 'rådgivning' ||
           payload.type === 'radgivning' ||
           payload.meta?.type === 'rådgivning' ||
           payload.meta?.type === 'radgivning' ||
           payload.meta?.source === 'radgivning' ||
           payload.message ||
           payload.primaryGoal ||
           payload.designStrategy ||
           payload.ongoingSupport ||
           payload.aiMediaHelp ||
           payload.answers?.message ||
           payload.answers?.primaryGoal ||
           payload.answers?.designStrategy) {
    categorized.category = 'radgivning';
    categorized.radgivningData = {
      questions: [
        { question: 'Meddelande', answer: payload.message || payload.answers?.message || '' },
        { question: 'Primärt mål', answer: payload.primaryGoal || payload.answers?.primaryGoal || '' },
        { question: 'Designstrategi', answer: payload.designStrategy || payload.answers?.designStrategy || '' },
        { question: 'Pågående support', answer: payload.ongoingSupport || payload.answers?.ongoingSupport || '' },
        { question: 'AI Media hjälp', answer: payload.aiMediaHelp || payload.answers?.aiMediaHelp || '' },
        { question: 'Extra information', answer: payload.extra || payload.answers?.extra || '' }
      ].filter(q => q.answer.trim()),
      sessionId: payload.sessionId,
      priority: payload.meta?.priority || 'medium'
    };
  }
  // Default to ads
  else {
    categorized.category = 'ads';
  }
  
  return categorized;
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

    // Log incoming payload for debugging
    console.log('[INGEST] Received payload:', {
      idempotencyKey: payload.idempotencyKey,
      tenantId: payload.tenantId,
      type: payload.type,
      category: payload.meta?.category,
      hasImageUrl: !!payload.imageUrl,
      hasPdfUrl: !!payload.pdfUrl,
      hasMessage: !!payload.message,
      hasPrimaryGoal: !!payload.primaryGoal,
      hasDesignStrategy: !!payload.designStrategy,
      keys: Object.keys(payload)
    });

    // NEW: Categorize the submission
    const categorizedPayload = categorizeSubmission(payload);
    
    // Log categorization result
    console.log('[INGEST] Categorized as:', {
      category: categorizedPayload.category,
      aiStudioData: categorizedPayload.aiStudioData ? {
        generationType: categorizedPayload.aiStudioData.generationType,
        imagesCount: categorizedPayload.aiStudioData.generatedImages?.length || 0,
        pdfsCount: categorizedPayload.aiStudioData.generatedPDFs?.length || 0
      } : null,
      radgivningData: categorizedPayload.radgivningData ? {
        questionsCount: categorizedPayload.radgivningData.questions?.length || 0,
        priority: categorizedPayload.radgivningData.priority
      } : null
    });
    
    // Upsert på idempotencyKey (idempotent)
    await Ad.updateOne(
      { idempotencyKey: categorizedPayload.idempotencyKey },
      { $setOnInsert: categorizedPayload },
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
