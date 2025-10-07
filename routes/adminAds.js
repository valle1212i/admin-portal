// routes/adminAds.js
const express = require('express');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const router = express.Router();

const Ad = require('../models/Ad'); // admin-modellen vi skapade


console.log('🟢 routes/adminAds.js laddad');
router.get('/', requireAdminLogin, async (req, res) => {
  try {
    // --- filter & paginering ---
    const filter = {};
    if (req.query.tenant)   filter.tenantId = req.query.tenant;
    if (req.query.platform) filter.platform = req.query.platform;
    if (req.query.status)   filter.status   = req.query.status;

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    // Free-text q: sök i både nytt schema (answers.q1..q7) och ev. legacy q1..q7
    const q = (req.query.q || '').trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        // nytt schema
        { 'answers.q1': rx }, { 'answers.q2': rx }, { 'answers.q3': rx },
        { 'answers.q4': rx }, { 'answers.q5': rx }, { 'answers.q6': rx }, { 'answers.q7': rx },
        // legacy
        { q1: rx }, { q2: rx }, { q3: rx }, { q4: rx }, { q5: rx }, { q6: rx }, { q7: rx },
        // övrigt
        { extraInfo: rx }, { userEmail: rx }, { userId: rx }
      ];
    }

    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Ad.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Ad.countDocuments(filter)
    ]);

    // Behåll fälten som admin-UI:t förväntar (preview funkar ändå mot answers)
    res.json({
      page, limit, total, source: 'primary',
      items: items.map(d => ({
        _id: d._id,
        platform: d.platform || null,
        createdAt: d.createdAt || null,
        // passera vidare ev. legacy fält för kompatibilitet
        q1: d.q1, q2: d.q2, q3: d.q3, q4: d.q4, q5: d.q5, q6: d.q6, q7: d.q7,
        extraInfo: d.extraInfo,
        userEmail: d.userEmail,
        userId: d.userId,
        // viktigast: answers (nytt schema) – admin-marknadsföring.html läser detta
        answers: d.answers || {},
        tenantId: d.tenantId || null
      }))
    });
  } catch (err) {
    console.error('❌ /api/admin/ads fel:', err);
    res.status(500).json({ error: 'Internt serverfel' });
  }
});


// Säkerställ att API alltid svarar JSON 401 om admin-session saknas (ingen HTML-redirect)
router.use((req, res, next) => {
  const hasSession = !!(req.session && req.session.admin);
  if (!hasSession) {
    console.warn('⚠️ /api/admin/ads utan admin-session:', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
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



// Admin-skydd: återanvänd middleware om du har den (annars kommentera bort nästa rad)
const requireAdminLogin = require('../middleware/requireAdminLogin');

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



// GET /api/admin/ads
router.get('/', requireAdminLogin, async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);

    const q        = (req.query.q || '').trim();
    const platform = (req.query.platform || '').trim();
    const from     = toDate(req.query.from);
    const to       = toDate(req.query.to);

    const { col, source } = await getAdsCollection();

    const match = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [
        { userEmail: rx }, { userId: rx },
        { q1: rx }, { q2: rx }, { q3: rx }, { q4: rx }, { q5: rx }, { q6: rx }, { q7: rx },
        { extraInfo: rx }, { topic: rx }, { description: rx }
      ];
    }
    if (platform) {
      match.platform = new RegExp('^' + platform + '$', 'i');
    }
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = from;
      if (to)   match.createdAt.$lte = to;
    }

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          total: [{ $count: 'n' }],
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }]
        }
      }
    ];

    const agg = await col.aggregate(pipeline).toArray();
const total = agg[0]?.total?.[0]?.n || 0;
const items = (agg[0]?.items || []).map(d => ({
  _id: d._id,
  platform: d.platform || null,
  createdAt: d.createdAt || d.timestamp || null,
  q1: d.q1, q2: d.q2, q3: d.q3, q4: d.q4, q5: d.q5, q6: d.q6, q7: d.q7,
  extraInfo: d.extraInfo,
  userEmail: d.userEmail, userId: d.userId,
  _fallback: String(source).startsWith('fallback')
}));

const { dbName } = getTargetDb();
console.log(`ℹ️ /api/admin/ads -> db="${dbName}", collection="${source}", page=${page}, limit=${limit}, matchKeys=${Object.keys(match)}`);
res.json({ page, limit, total, items, source, db: dbName });
  } catch (err) {
    console.error('❌ /api/admin/ads fel:', err);
    res.status(500).json({ error: 'Internt serverfel' });
  }
});
// DEBUG: lista collections och storlekar (GDPR-säkert, inga dokument returneras)
router.get('/_debug', requireAdminLogin, async (_req, res) => {
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
router.get('/:id', requireAdminLogin, async (req, res) => {
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
