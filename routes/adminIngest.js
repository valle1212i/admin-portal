const express = require('express');
const mongoose = require('mongoose');
const AdminStudioRådgivning = require('../models/AdminStudioRådgivning');

const router = express.Router();

console.log('🟢 routes/adminIngest.js laddad');

// Middleware to validate shared secret
const validateSecret = (req, res, next) => {
  const providedSecret = req.headers['x-admin-secret'] || req.body.secret;
  const expectedSecret = process.env.ADMIN_SHARED_SECRET || 'default-secret';
  
  if (providedSecret !== expectedSecret) {
    console.warn('⚠️ Invalid admin secret provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Helper function to determine data source
function determineSource(data) {
  if (data.platform || data.answers || data.q1 || data.q2 || data.q3 || data.q4 || data.q5 || data.q6 || data.q7) {
    return 'ai-studio';
  }
  if (data.sessionId || data.messages || data.topic) {
    return 'radgivning';
  }
  return 'manual';
}

// POST /admin/api/ingest/radgivning - Ingest rådgivning data
router.post('/radgivning', validateSecret, async (req, res) => {
  try {
    const data = req.body;
    
    // Validate required fields
    if (!data.customerEmail) {
      return res.status(400).json({ error: 'customerEmail is required' });
    }

    // Determine if this is AI Studio or Rådgivning data
    const source = determineSource(data);
    
    // Prepare document for insertion
    const document = {
      customerEmail: data.customerEmail,
      customerName: data.customerName || data.name,
      source: source,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      status: data.status || 'open',
      tenantId: data.tenantId,
      userId: data.userId,
      userEmail: data.userEmail,
      tags: Array.isArray(data.tags) ? data.tags : [],
      
      // AI Studio fields
      platform: data.platform,
      answers: data.answers || {},
      q1: data.q1, q2: data.q2, q3: data.q3, q4: data.q4, q5: data.q5, q6: data.q6, q7: data.q7,
      extraInfo: data.extraInfo,
      
      // Rådgivning fields
      sessionId: data.sessionId,
      messages: Array.isArray(data.messages) ? data.messages.map(msg => ({
        message: msg.message || msg.text,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        sender: msg.sender || 'customer',
        messageId: msg.messageId || msg.id
      })) : [],
      topic: data.topic,
      description: data.description || data.message,
      priority: data.priority || 'medium',
      assignedAdmin: data.assignedAdmin,
      closedAt: data.closedAt ? new Date(data.closedAt) : null,
      closedBy: data.closedBy,
      
      // Metadata
      metadata: data.metadata || {}
    };

    // Create new document
    const newDoc = new AdminStudioRådgivning(document);
    const savedDoc = await newDoc.save();

    console.log(`✅ Ingested ${source} data for ${data.customerEmail}:`, savedDoc._id);

    res.json({
      success: true,
      id: savedDoc._id,
      source: source,
      message: `Successfully ingested ${source} data`
    });

  } catch (error) {
    console.error('❌ Error ingesting rådgivning data:', error);
    res.status(500).json({ 
      error: 'Failed to ingest data', 
      details: error.message 
    });
  }
});

// POST /admin/api/ingest/ai-studio - Ingest AI Studio data (alternative endpoint)
router.post('/ai-studio', validateSecret, async (req, res) => {
  try {
    const data = req.body;
    
    // Validate required fields
    if (!data.customerEmail) {
      return res.status(400).json({ error: 'customerEmail is required' });
    }

    // Prepare AI Studio document
    const document = {
      customerEmail: data.customerEmail,
      customerName: data.customerName || data.name,
      source: 'ai-studio',
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      status: 'open',
      tenantId: data.tenantId,
      userId: data.userId,
      userEmail: data.userEmail,
      tags: Array.isArray(data.tags) ? data.tags : [],
      
      // AI Studio specific fields
      platform: data.platform,
      answers: data.answers || {},
      q1: data.q1, q2: data.q2, q3: data.q3, q4: data.q4, q5: data.q5, q6: data.q6, q7: data.q7,
      extraInfo: data.extraInfo,
      
      // Metadata
      metadata: data.metadata || {}
    };

    const newDoc = new AdminStudioRådgivning(document);
    const savedDoc = await newDoc.save();

    console.log(`✅ Ingested AI Studio data for ${data.customerEmail}:`, savedDoc._id);

    res.json({
      success: true,
      id: savedDoc._id,
      source: 'ai-studio',
      message: 'Successfully ingested AI Studio data'
    });

  } catch (error) {
    console.error('❌ Error ingesting AI Studio data:', error);
    res.status(500).json({ 
      error: 'Failed to ingest data', 
      details: error.message 
    });
  }
});

// GET /admin/api/ingest/status - Health check endpoint
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /admin/api/ingest/radgivning',
      'POST /admin/api/ingest/ai-studio',
      'GET /admin/api/ingest/status'
    ]
  });
});

// GET /admin/api/ingest/debug - Debug endpoint to check recent ingestions
router.get('/debug', validateSecret, async (req, res) => {
  try {
    const recent = await AdminStudioRådgivning.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('customerEmail source platform createdAt status')
      .lean();

    const counts = await AdminStudioRådgivning.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      recent: recent,
      counts: counts,
      total: await AdminStudioRådgivning.countDocuments()
    });
  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({ error: 'Debug failed', details: error.message });
  }
});

module.exports = router;
