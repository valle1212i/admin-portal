// routes/adminIngestHmac.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Ad = require('../models/Ad'); // <- den admin-modell jag gav dig tidigare
const Case = require('../models/Case'); // Admin portal's Case model

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
  
  // Check for Case indicators
  if (payload.type === 'case' || payload.type === 'case_response') {
    categorized.category = payload.type;
    return categorized;
  }
  // Check for AI Studio indicators
  else if (payload.meta?.source === 'ai-studio' || 
      payload.answers?.generationType ||
      payload.meta?.generationType ||
      payload.answers?.generatedImages ||
      payload.answers?.generatedPDFs) {
    categorized.category = 'ai-studio';
    categorized.aiStudioData = {
      generatedImages: payload.answers?.generatedImages || payload.meta?.generatedImages || [],
      generatedPDFs: payload.answers?.generatedPDFs || payload.meta?.generatedPDFs || [],
      generationType: payload.answers?.generationType || payload.meta?.generationType,
      prompt: payload.answers?.prompt || payload.extraInfo || payload.meta?.prompt
    };
  }
  // Check for Rådgivning indicators
  else if (payload.meta?.source === 'radgivning' ||
           payload.sessionId ||
           payload.answers?.questions ||
           payload.meta?.questions ||
           payload.answers?.primaryGoal ||
           payload.answers?.designStrategy) {
    categorized.category = 'radgivning';
    categorized.radgivningData = {
      questions: payload.answers?.questions || payload.meta?.questions || [],
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

    // NEW: Categorize the submission
    const categorizedPayload = categorizeSubmission(payload);
    const { idempotencyKey } = categorizedPayload;
    const submissionType = categorizedPayload.category;
    
    // Handle different submission types
    if (submissionType === 'case') {
      // Handle case submissions - save to AdminPanel.adminportal.cases
      const caseData = (payload && typeof payload.case === 'object') ? payload.case : {};
      const data = (payload && typeof payload.data === 'object') ? payload.data : {};

      // Clean and validate messages
      const cleanedMessages = (caseData.messages || []).map(msg => {
        // Clean sender value - convert to lowercase and handle common variations
        let cleanSender = msg.sender;
        if (cleanSender) {
          cleanSender = cleanSender.toLowerCase();
          if (cleanSender === 'support') cleanSender = 'admin'; // Map support to admin
        }
        
        // Ensure message is not empty/undefined
        const cleanMessage = msg.message && msg.message.trim() ? msg.message.trim() : null;
        
        // Only include messages that have valid content
        if (cleanMessage && cleanSender) {
          return {
            sender: cleanSender,
            senderName: msg.senderName || '',
            senderEmail: msg.senderEmail || '',
            message: cleanMessage,
            timestamp: msg.timestamp || new Date()
          };
        }
        return null; // Filter out invalid messages
      }).filter(msg => msg !== null); // Remove null entries

      // Map Swedish status values to English enum values
      const statusMapping = {
        'Öppen': 'open',
        'Nytt': 'new', 
        'Arbetande': 'in_progress',
        'Väntar svar': 'waiting',
        'On Hold': 'on_hold',
        'Stängt': 'closed',
        'open': 'open',
        'new': 'new',
        'in_progress': 'in_progress',
        'waiting': 'waiting',
        'on_hold': 'on_hold',
        'closed': 'closed'
      };
      
      const cleanStatus = statusMapping[caseData.status] || 'open';
      
      console.log('[ADMIN INGEST CASE] Status mapping:', { 
        original: caseData.status, 
        mapped: cleanStatus 
      });

      // Create case document for AdminPanel.adminportal.cases
      const caseDocument = {
        customerId: caseData.customerId,
        sessionId: caseData.sessionId,
        topic: caseData.topic,
        description: caseData.description,
        messages: cleanedMessages,
        priority: caseData.priority || 'Normal',
        tags: caseData.tags || [],
        tenant: caseData.tenantId || 'default',
        status: cleanStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to AdminPanel.adminportal.cases collection
      const newCase = new Case(caseDocument);
      await newCase.save();

      console.log('[ADMIN INGEST CASE] Successfully saved to AdminPanel.adminportal.cases', { 
        id: newCase._id, 
        customerId: newCase.customerId,
        topic: newCase.topic,
        tenant: newCase.tenant 
      });

      return res.json({ success: true, id: newCase._id, idempotencyKey });

    } else if (submissionType === 'case_response') {
      // Handle case response submissions - update existing case
      const responseData = (payload && typeof payload.caseResponse === 'object') ? payload.caseResponse : {};
      
      // Find and update the existing case
      const existingCase = await Case.findById(responseData.caseId);
      
      if (!existingCase) {
        console.log('[ADMIN INGEST CASE_RESPONSE] Case not found:', responseData.caseId);
        return res.status(404).json({ success: false, error: 'Case not found' });
      }

      // Validate and clean the response message
      const cleanMessage = responseData.message && responseData.message.trim() ? responseData.message.trim() : null;
      
      if (!cleanMessage) {
        console.log('[ADMIN INGEST CASE_RESPONSE] Invalid message content:', responseData.message);
        return res.status(400).json({ success: false, error: 'Message content is required' });
      }

      // Add customer response to case
      const newMessage = {
        sender: 'customer',
        senderName: responseData.senderName || 'Customer',
        senderEmail: responseData.senderEmail || '',
        message: cleanMessage,
        timestamp: responseData.timestamp || new Date()
      };

      existingCase.messages.push(newMessage);
      
      // Update case status if it was closed
      if (existingCase.status === 'closed') {
        existingCase.status = 'open';
      }
      
      existingCase.updatedAt = new Date();
      await existingCase.save();

      console.log('[ADMIN INGEST CASE_RESPONSE] Successfully updated case', { 
        caseId: existingCase._id, 
        messageCount: existingCase.messages.length,
        status: existingCase.status 
      });

      return res.json({ success: true, id: existingCase._id, idempotencyKey });
      
    } else {
      // Handle other submission types (ads, ai-studio, radgivning) - original logic
      await Ad.updateOne(
        { idempotencyKey: categorizedPayload.idempotencyKey },
        { $setOnInsert: categorizedPayload },
        { upsert: true }
      );

      // 204 = No Content (inget behov att skicka något tillbaka)
      return res.status(204).end();
    }
  } catch (e) {
    console.error('[INGEST] error:', e);
    return res.status(500).json({ success:false, error:'Server error' });
  }
});

module.exports = router;
