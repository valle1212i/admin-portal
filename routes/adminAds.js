// routes/adminAds.js
const express = require('express');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const router = express.Router();
const requireAdminLogin = require('../middleware/requireAdminLogin');
const Ad = require('../models/Ad'); // admin-modellen vi skapade


console.log('🟢 routes/adminAds.js laddad');

// Säkerställ att API alltid svarar JSON 401 om admin-session saknas (ingen HTML-redirect)
router.use((req, res, next) => {
  const hasSession = !!(req.session && req.session.admin);
  if (!hasSession) {
    console.warn('⚠️ /api/admin/ads utan admin-session:', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET /api/admin/ads/summary - Get total counts for summary
router.get('/summary', async (req, res) => {
  try {
    const [adsCount, aiStudioCount, radgivningCount] = await Promise.all([
      Ad.countDocuments({ category: 'ads' }),
      Ad.countDocuments({ category: 'ai-studio' }),
      Ad.countDocuments({ category: 'radgivning' })
    ]);
    
    const total = adsCount + aiStudioCount + radgivningCount;
    
    res.json({
      total,
      ads: adsCount,
      aiStudio: aiStudioCount,
      radgivning: radgivningCount
    });
  } catch (error) {
    console.error('Summary endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /api/admin/ads - Main handler using Mongoose Ad model
router.get('/', async (req, res) => {
  try {
    // --- filter & paginering ---
    const filter = {};
    
    // NEW: Category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.tenant)   filter.tenantId = req.query.tenant;
    if (req.query.platform) filter.platform = req.query.platform;
    if (req.query.status)   filter.status   = req.query.status;

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    // Enhanced search to include category-specific fields
    const q = (req.query.q || '').trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        // Standard fields
        { 'answers.q1': rx }, { 'answers.q2': rx }, { 'answers.q3': rx },
        { 'answers.q4': rx }, { 'answers.q5': rx }, { 'answers.q6': rx }, { 'answers.q7': rx },
        { q1: rx }, { q2: rx }, { q3: rx }, { q4: rx }, { q5: rx }, { q6: rx }, { q7: rx },
        { extraInfo: rx }, { userEmail: rx }, { userId: rx },
        // AI Studio fields
        { 'aiStudioData.generationType': rx }, { 'aiStudioData.prompt': rx },
        // Rådgivning fields
        { 'radgivningData.questions.question': rx }, { 'radgivningData.questions.answer': rx }
      ];
    }

    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip  = (page - 1) * limit;

    // Ensure we only get real ad briefs, not chat/case data
    const adFilter = {
      ...filter,
      $and: [
        // Must have platform OR answers OR legacy q1..q7 fields
        {
          $or: [
            { platform: { $in: ['google', 'meta', 'tiktok', 'linkedin'] } },
            { answers: { $type: 'object' } },
            { q1: { $exists: true } },
            { q2: { $exists: true } },
            { q3: { $exists: true } },
            { q4: { $exists: true } },
            { q5: { $exists: true } },
            { q6: { $exists: true } },
            { q7: { $exists: true } },
            { extraInfo: { $exists: true } },
            { idempotencyKey: { $exists: true } }
          ]
        },
        // Exclude chat/case-like documents
        {
          $and: [
            { messages: { $exists: false } },
            { sessionId: { $exists: false } }
          ]
        }
      ]
    };

    // Dynamic sorting implementation
    const sortParam = req.query.sort || 'createdAt-desc';
    let sortObj = { createdAt: -1, _id: -1 }; // default

    // Parse sort parameter
    if (sortParam.includes('createdAt')) {
      sortObj = sortParam.includes('asc') 
        ? { createdAt: 1, _id: 1 } 
        : { createdAt: -1, _id: -1 };
    } else if (sortParam.includes('category')) {
      sortObj = sortParam.includes('asc') 
        ? { category: 1, createdAt: -1 } 
        : { category: -1, createdAt: -1 };
    } else if (sortParam.includes('tenantId')) {
      sortObj = sortParam.includes('asc') 
        ? { tenantId: 1, createdAt: -1 } 
        : { tenantId: -1, createdAt: -1 };
    } else if (sortParam.includes('userEmail')) {
      sortObj = sortParam.includes('asc') 
        ? { userEmail: 1, createdAt: -1 } 
        : { userEmail: -1, createdAt: -1 };
    }

    const [items, total] = await Promise.all([
      Ad.find(adFilter).sort(sortObj).skip(skip).limit(limit).lean(),
      Ad.countDocuments(adFilter)
    ]);

    // Enhanced response with category-specific fields
    res.json({
      page, limit, total, source: 'primary',
      items: items.map(d => ({
        _id: d._id,
        category: d.category || 'ads',
        platform: d.platform || null,
        createdAt: d.createdAt || null,
        tenantId: d.tenantId,
        userEmail: d.userEmail,
        userId: d.userId,
        answers: d.answers || {},
        aiStudioData: d.aiStudioData,
        radgivningData: d.radgivningData,
        // Legacy fields for compatibility
        q1: d.q1, q2: d.q2, q3: d.q3, q4: d.q4, q5: d.q5, q6: d.q6, q7: d.q7,
        extraInfo: d.extraInfo
      }))
    });
  } catch (err) {
    console.error('❌ /api/admin/ads fel:', err);
    res.status(500).json({ error: 'Internt serverfel' });
  }
});

// Valfritt: sätt via .env om din collection heter något annat
const ADS_COLLECTION_CANDIDATES = (process.env.ADS_COLLECTIONS || 'Ad,ads,marketingBriefs,adbriefs,campaignBriefs')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Hämta mål-DB: ADS_DBNAME om satt, annars nuvarande anslutnings DB
function getTargetDb() {
  const client = mongoose.connection.getClient();
  const dbName = process.env.ADS_DBNAME || mongoose.connection.db.databaseName;
  return { db: client.db(dbName), dbName };
}



// Admin-skydd middleware importeras upptill

function toDate(val) {
  try { return val ? new Date(val) : null; } catch { return null; }
}

// Hämta första existerande collection från kandidatlistan
async function getAdsCollection() {
  const { db, dbName } = getTargetDb();

  for (const name of ADS_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name }).hasNext();
    if (exists) {
      return { col: db.collection(name), source: `${dbName}.${name}` };
    }
  }

  // Fallback: välj första strängen (kan vara tom) + markera fallback
  const first = ADS_COLLECTION_CANDIDATES[0] || 'ads';
  return { col: db.collection(first), source: `fallback:${dbName}.${first}` };
}



// Note: The main GET handler is defined above (lines 12-71) using Mongoose Ad model
// DEBUG: lista collections och storlekar (GDPR-säkert, inga dokument returneras)
router.get('/_debug', async (_req, res) => {
  try {
    const { db, dbName } = getTargetDb();
    const cur = db.listCollections({}, { nameOnly: true });
    const names = [];
    while (await cur.hasNext()) {
      const n = await cur.next();
      names.push(n.name);
    }

    const sized = await Promise.all(
      names.map(async (name) => {
        const col = db.collection(name);
        const count = await col.estimatedDocumentCount().catch(() => -1);
        return { name, count };
      })
    );

    res.json({
      db: dbName,
      candidates: ADS_COLLECTION_CANDIDATES,
      collections: sized.sort((a,b)=> a.name.localeCompare(b.name))
    });
  } catch (err) {
    console.error('❌ /api/admin/ads/_debug fel:', err);
    res.status(500).json({ error: 'Internt serverfel' });
  }
});

// GET /api/admin/ads/:id
router.get('/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongoose').Types;
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Ogiltigt id' });

    const doc = await Ad.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'Hittades ej' });

    res.json({
      ...doc,
      createdAt: doc.createdAt || null
    });
  } catch (err) {
    console.error('❌ /api/admin/ads/:id fel:', err);
    res.status(500).json({ error: 'Internt serverfel' });
  }
});


module.exports = router;
