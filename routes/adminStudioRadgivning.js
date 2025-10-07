// routes/adminStudioRadgivning.js
const express = require('express');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const AdminStudioRådgivning = require('../models/AdminStudioRådgivning');

const router = express.Router();
const requireAdminLogin = require('../middleware/requireAdminLogin');

console.log('🟢 routes/adminStudioRadgivning.js laddad');

// Säkerställ att API alltid svarar JSON 401 om admin-session saknas (ingen HTML-redirect)
router.use((req, res, next) => {
  const hasSession = !!(req.session && req.session.admin);
  if (!hasSession) {
    console.warn('⚠️ /api/admin/studio-radgivning utan admin-session:', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Helper functions
function toDate(val) {
  try { 
    return val ? new Date(val) : null; 
  } catch { 
    return null; 
  }
}

function safeStr(x) { 
  return (x ?? '').toString(); 
}

function esc(s) { 
  return String(s != null ? s : '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]); 
}

// Get target database connection for adminportal.studioradgivning
function getStudioRadgivningDb() {
  const client = mongoose.connection.getClient();
  const dbName = 'adminportal'; // Database name
  return { db: client.db(dbName), dbName };
}

// GET /api/admin/studio-radgivning - Main handler for AI Studio and Rådgivning data
router.get('/', async (req, res) => {
  try {
    // Build filter
    const filter = {};
    
    // Date range filter
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status.toLowerCase();
    }

    // Search query
    const q = (req.query.q || '').trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { customerEmail: rx },
        { customerName: rx },
        { message: rx },
        { topic: rx },
        { description: rx },
        { tags: { $in: [rx] } },
        { 'answers.q1': rx },
        { 'answers.q2': rx },
        { 'answers.q3': rx },
        { 'answers.q4': rx },
        { 'answers.q5': rx },
        { 'answers.q6': rx },
        { 'answers.q7': rx },
        { extraInfo: rx }
      ];
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    // Execute query using Mongoose model
    const [items, total] = await Promise.all([
      AdminStudioRådgivning.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminStudioRådgivning.countDocuments(filter)
    ]);

    // Transform data for admin UI
    const transformedItems = items.map(item => {
      // Determine data type
      const dataType = item.source || 'unknown';
      
      // Extract answers (both new schema and legacy)
      const answers = item.answers || {};
      if (!item.answers) {
        ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'extraInfo'].forEach(k => {
          if (item[k] != null && item[k] !== '') {
            answers[k] = item[k];
          }
        });
      }

      return {
        _id: item._id,
        dataType,
        platform: item.platform || null,
        customerEmail: item.customerEmail || null,
        customerName: item.customerName || null,
        createdAt: item.createdAt || null,
        status: item.status || 'open',
        message: item.description || item.topic || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        answers,
        sessionId: item.sessionId || null,
        tenantId: item.tenantId || null,
        userEmail: item.userEmail || null,
        userId: item.userId || null,
        // Legacy fields for compatibility
        q1: item.q1, q2: item.q2, q3: item.q3, q4: item.q4, q5: item.q5, q6: item.q6, q7: item.q7,
        extraInfo: item.extraInfo
      };
    });

    res.json({
      page,
      limit,
      total,
      source: 'mongoose-model',
      items: transformedItems
    });

  } catch (err) {
    console.error('❌ /api/admin/studio-radgivning fel:', err);
    res.status(500).json({ error: 'Internt serverfel', details: err.message });
  }
});

// GET /api/admin/studio-radgivning/:id - Get specific document
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Ogiltigt id' });
    }

    const doc = await AdminStudioRådgivning.findById(id).lean();
    if (!doc) {
      return res.status(404).json({ error: 'Hittades ej' });
    }

    res.json(doc);
  } catch (err) {
    console.error('❌ /api/admin/studio-radgivning/:id fel:', err);
    res.status(500).json({ error: 'Internt serverfel', details: err.message });
  }
});

// GET /api/admin/studio-radgivning/_debug - Debug endpoint to check collection info
router.get('/_debug', async (req, res) => {
  try {
    const count = await AdminStudioRådgivning.estimatedDocumentCount();
    const sample = await AdminStudioRådgivning.findOne({}, {}, { sort: { createdAt: -1 } }).lean();
    
    const sourceCounts = await AdminStudioRådgivning.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      model: 'AdminStudioRådgivning',
      count,
      sourceCounts,
      sample: sample ? {
        _id: sample._id,
        createdAt: sample.createdAt,
        source: sample.source,
        hasAnswers: !!sample.answers,
        hasPlatform: !!sample.platform,
        hasSessionId: !!sample.sessionId,
        hasMessages: !!sample.messages,
        customerEmail: sample.customerEmail
      } : null
    });
  } catch (err) {
    console.error('❌ /api/admin/studio-radgivning/_debug fel:', err);
    res.status(500).json({ error: 'Internt serverfel', details: err.message });
  }
});

module.exports = router;
