const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const crypto = require('crypto');

console.log('🟢 routes/adminIngestCases.js laddad');

// HMAC signature verification
function verifySignature(rawBody, signature) {
  const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET;
  if (!ADMIN_SHARED_SECRET) {
    console.warn('[ADMIN INGEST CASES] ADMIN_SHARED_SECRET saknas i .env');
    return false;
  }
  
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }
  
  const sent = signature.slice(7);
  const expectedSig = crypto.createHmac('sha256', ADMIN_SHARED_SECRET).update(rawBody).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(sent, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

// Raw body middleware
function rawBodyBuffer(req, _res, buf) {
  req.rawBody = buf;
}

router.use(express.json({ verify: rawBodyBuffer, limit: '200kb' }));

// Cases ingest endpoint
router.post('/', async (req, res) => {
  try {
    console.log('[ADMIN INGEST CASES] Received request', {
      ip: req.ip,
      hasSignature: !!req.get('x-signature'),
      hasIdempotencyKey: !!req.get('x-idempotency-key'),
      hasTenant: !!req.get('x-tenant'),
      bodyKeys: Object.keys(req.body || {}),
      submissionType: req.body?.type || 'case'
    });

    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const sig = req.get('x-signature') || '';
    if (!verifySignature(raw, sig)) {
      console.log('[ADMIN INGEST CASES] Signature verification failed');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    console.log('[ADMIN INGEST CASES] Signature verified successfully');

    const idempotencyKey = String(req.body?.idempotencyKey || '').trim();
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, error: 'idempotencyKey required' });
    }

    const tenantId = String(req.body?.tenantId || req.get('x-tenant') || '').trim().toLowerCase();
    const submissionType = String(req.body?.type || 'case').trim().toLowerCase();
    const userId = req.body?.userId || null;
    const meta = (req.body && typeof req.body.meta === 'object') ? req.body.meta : {};

    if (!tenantId) return res.status(400).json({ success: false, error: 'tenantId required' });

    // Handle case creation
    if (submissionType === 'case') {
      // Extract case data - check both nested and direct structures
      const caseData = (req.body && typeof req.body.case === 'object') ? req.body.case : req.body;
      const data = (req.body && typeof req.body.data === 'object') ? req.body.data : {};

      console.log('[ADMIN INGEST CASES] Extracted case data:', {
        caseDataKeys: Object.keys(caseData || {}),
        sessionId: caseData?.sessionId,
        customerId: caseData?.customerId,
        topic: caseData?.topic,
        description: caseData?.description,
        messagesCount: caseData?.messages?.length || 0,
        messages: caseData?.messages || []
      });

      // Validate required fields for case creation
      if (!caseData.sessionId) {
        return res.status(400).json({ success: false, error: 'Missing sessionId' });
      }
      if (!caseData.customerId) {
        return res.status(400).json({ success: false, error: 'Missing customerId' });
      }
      if (!caseData.topic) {
        return res.status(400).json({ success: false, error: 'Missing topic' });
      }
      if (!caseData.description) {
        return res.status(400).json({ success: false, error: 'Missing description' });
      }

      // Clean and validate messages for case creation
      let cleanedMessages = [];
      console.log('[ADMIN INGEST CASES] Processing messages:', {
        hasMessages: !!caseData.messages,
        isArray: Array.isArray(caseData.messages),
        messageCount: caseData.messages?.length || 0
      });
      
      if (caseData.messages && Array.isArray(caseData.messages)) {
        cleanedMessages = caseData.messages.map((msg, index) => {
          console.log(`[ADMIN INGEST CASES] Processing message ${index}:`, {
            originalMsg: msg,
            sender: msg.sender || msg.type,
            content: msg.message || msg.content
          });
          // Clean sender value - handle both 'sender' and 'type' fields from customer portal
          let cleanSender = msg.sender || msg.type;
          if (cleanSender) {
            cleanSender = cleanSender.toLowerCase();
            if (cleanSender === 'support') cleanSender = 'admin'; // Map support to admin
            if (cleanSender === 'customer') cleanSender = 'customer'; // Ensure customer is lowercase
            if (cleanSender === 'ai assistant') cleanSender = 'admin'; // Map AI Assistant to admin
          }
          
          // Handle both 'message' and 'content' fields from customer portal
          const messageContent = msg.message || msg.content;
          const cleanMessage = messageContent && messageContent.trim() ? messageContent.trim() : null;
          
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
        
        console.log('[ADMIN INGEST CASES] Cleaned messages result:', {
          originalCount: caseData.messages.length,
          cleanedCount: cleanedMessages.length,
          cleanedMessages: cleanedMessages
        });
      }

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
      
      console.log('[ADMIN INGEST CASES] Status mapping:', { 
        original: caseData.status, 
        mapped: cleanStatus 
      });

      // Create case document for AdminPanel.adminportal.cases
      const caseDocument = {
        customerId: caseData.customerId,
        sessionId: caseData.sessionId,
        topic: caseData.topic,
        description: caseData.description || caseData.topic || 'No description provided',
        messages: cleanedMessages,
        priority: caseData.priority || 'Normal',
        tags: caseData.tags || [],
        tenant: tenantId,
        status: cleanStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('[ADMIN INGEST CASES] Case document created:', {
        customerId: caseDocument.customerId,
        sessionId: caseDocument.sessionId,
        topic: caseDocument.topic,
        description: caseDocument.description,
        status: caseDocument.status,
        messageCount: caseDocument.messages.length
      });

      // Save to AdminPanel.adminportal.cases collection
      const newCase = new Case(caseDocument);
      await newCase.save();

      console.log('[ADMIN INGEST CASES] Successfully saved to AdminPanel.adminportal.cases', { 
        id: newCase._id, 
        customerId: newCase.customerId,
        topic: newCase.topic,
        tenant: newCase.tenant 
      });

      return res.json({ success: true, id: newCase._id, idempotencyKey });
    }

    // Handle case response submissions - update existing case
    if (submissionType === 'case_response') {
      // Extract response data from both possible locations
      const responseData = (req.body && typeof req.body.caseResponse === 'object') ? req.body.caseResponse : 
                          (req.body && typeof req.body.data === 'object') ? req.body.data : {};
      
      console.log('[ADMIN INGEST CASES] Case response data:', {
        responseDataKeys: Object.keys(responseData || {}),
        caseId: responseData?.caseId,
        customerId: responseData?.customerId,
        message: responseData?.message,
        hasCaseResponse: !!req.body.caseResponse,
        hasData: !!req.body.data
      });
      
      if (!responseData.caseId) {
        return res.status(400).json({ success: false, error: 'Missing caseId for case response' });
      }
      
      // Find and update the existing case
      const existingCase = await Case.findById(responseData.caseId);
      
      if (!existingCase) {
        console.log('[ADMIN INGEST CASES] Case not found:', responseData.caseId);
        return res.status(404).json({ success: false, error: 'Case not found' });
      }

      // Validate and clean the response message
      const cleanMessage = responseData.message && responseData.message.trim() ? responseData.message.trim() : null;
      
      if (!cleanMessage) {
        console.log('[ADMIN INGEST CASES] Invalid message content:', responseData.message);
        return res.status(400).json({ success: false, error: 'Message content is required' });
      }

      // Add customer response to case
      const newMessage = {
        sender: 'customer',
        senderName: responseData.customerName || responseData.senderName || 'Customer',
        senderEmail: responseData.customerEmail || responseData.senderEmail || '',
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

      console.log('[ADMIN INGEST CASES] Successfully updated case', { 
        caseId: existingCase._id, 
        messageCount: existingCase.messages.length,
        status: existingCase.status 
      });

      return res.json({ success: true, id: existingCase._id, idempotencyKey });
    }

    // Handle invalid submission types
    if (submissionType !== 'case' && submissionType !== 'case_response') {
      return res.status(400).json({ success: false, error: 'Invalid submission type for cases endpoint' });
    }

  } catch (err) {
    console.error('[ADMIN INGEST CASES] error', err);
    return res.status(500).json({ success: false, error: 'server error' });
  }
});

module.exports = router;
