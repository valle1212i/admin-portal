# Statistics Integration Guide for Customer Portal

This guide provides instructions for integrating statistics tracking into the Source Customer Portal to collect data on AI performance, feature usage, and support quality.

## Overview

The admin portal now includes comprehensive analytics to track:
- AI assistant satisfaction (thumbs up/down)
- Feature usage patterns
- Support quality ratings
- Customer engagement metrics

## Environment Variables

Set these in your customer portal deployment:

```bash
ADMIN_PORTAL_URL=https://admin-portal-rn5z.onrender.com
# No authentication required for statistics endpoints (data is customer-specific)
```

## 1. AI Feedback Widget

### After Each AI Response

Add this HTML after each AI assistant response:

```html
<div class="ai-feedback" id="ai-feedback-{conversationId}">
  <p class="feedback-prompt">Var detta svar hjälpsamt?</p>
  <div class="feedback-buttons">
    <button class="feedback-btn feedback-positive" onclick="rateAI('{conversationId}', 'positive')">
      👍 Ja
    </button>
    <button class="feedback-btn feedback-negative" onclick="rateAI('{conversationId}', 'negative')">
      👎 Nej
    </button>
  </div>
  <div class="feedback-detail" id="feedback-detail-{conversationId}" style="display:none;">
    <textarea 
      placeholder="Valfritt: Berätta mer om vad som var bra eller dåligt..." 
      id="feedback-text-{conversationId}"
      rows="3"></textarea>
    <button onclick="submitDetailedFeedback('{conversationId}')">Skicka feedback</button>
  </div>
</div>

<style>
.ai-feedback {
  margin: 10px 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.feedback-prompt {
  font-size: 14px;
  color: #555;
  margin-bottom: 8px;
}

.feedback-buttons {
  display: flex;
  gap: 10px;
}

.feedback-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.feedback-btn:hover {
  background: #f0f0f0;
  transform: translateY(-1px);
}

.feedback-positive:hover {
  border-color: #2ecc71;
  color: #2ecc71;
}

.feedback-negative:hover {
  border-color: #e74c3c;
  color: #e74c3c;
}

.feedback-detail {
  margin-top: 10px;
}

.feedback-detail textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
}

.feedback-detail button {
  margin-top: 8px;
  padding: 6px 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

### JavaScript Implementation

Add this to your customer portal's main JavaScript file:

```javascript
// AI Feedback Tracker
class AIFeedbackTracker {
  constructor() {
    this.adminPortalUrl = 'https://admin-portal-rn5z.onrender.com';
    this.currentConversation = null;
  }

  // Track AI conversation
  startConversation(conversationId) {
    this.currentConversation = {
      conversationId,
      question: '',
      aiResponse: '',
      startTime: Date.now()
    };
  }

  setQuestion(question) {
    if (this.currentConversation) {
      this.currentConversation.question = question;
    }
  }

  setResponse(aiResponse) {
    if (this.currentConversation) {
      this.currentConversation.aiResponse = aiResponse;
      this.currentConversation.responseTime = Date.now() - this.currentConversation.startTime;
    }
  }

  async submitFeedback(conversationId, rating, feedbackText = '') {
    try {
      const customerId = this.getCurrentCustomerId();
      
      if (!customerId) {
        console.error('No customer ID found');
        return;
      }

      const conversation = this.currentConversation || {};

      const response = await fetch(`${this.adminPortalUrl}/api/statistics/ai-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId,
          question: conversation.question || 'N/A',
          aiResponse: conversation.aiResponse || 'N/A',
          rating,
          category: 'helpfulness',
          feedbackText,
          conversationId,
          responseTime: conversation.responseTime || 0,
          escalatedToHuman: false,
          resolved: rating === 'positive',
          timestamp: new Date()
        })
      });

      if (response.ok) {
        console.log('✅ AI feedback submitted successfully');
        return true;
      } else {
        console.error('❌ Failed to submit AI feedback:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Error submitting AI feedback:', error);
      return false;
    }
  }

  getCurrentCustomerId() {
    // Adjust based on how your customer portal stores customer data
    try {
      const customer = JSON.parse(localStorage.getItem('customer') || sessionStorage.getItem('customer') || 'null');
      return customer?._id || customer?.id || null;
    } catch (e) {
      return null;
    }
  }
}

// Initialize tracker
window.aiFeedbackTracker = new AIFeedbackTracker();

// Function to rate AI (called from HTML buttons)
async function rateAI(conversationId, rating) {
  const success = await window.aiFeedbackTracker.submitFeedback(conversationId, rating);
  
  if (success) {
    // Hide feedback buttons
    const feedbackElement = document.getElementById(`ai-feedback-${conversationId}`);
    if (feedbackElement) {
      feedbackElement.innerHTML = `
        <p style="color: #2ecc71; font-size: 14px;">✓ Tack för din feedback!</p>
      `;
    }

    // Show detail form if negative
    if (rating === 'negative') {
      const detailElement = document.getElementById(`feedback-detail-${conversationId}`);
      if (detailElement) {
        detailElement.style.display = 'block';
      }
    }
  }
}

// Function to submit detailed feedback
async function submitDetailedFeedback(conversationId) {
  const feedbackText = document.getElementById(`feedback-text-${conversationId}`)?.value || '';
  
  if (feedbackText.trim()) {
    await window.aiFeedbackTracker.submitFeedback(conversationId, 'negative', feedbackText);
  }
  
  // Hide detail form
  const detailElement = document.getElementById(`feedback-detail-${conversationId}`);
  if (detailElement) {
    detailElement.style.display = 'none';
  }
}
```

### Usage in AI Chat Component

```javascript
// When user asks a question
const conversationId = generateUniqueId(); // or use chat session ID
window.aiFeedbackTracker.startConversation(conversationId);
window.aiFeedbackTracker.setQuestion(userQuestion);

// When AI responds
window.aiFeedbackTracker.setResponse(aiResponse);

// Show feedback widget after AI response
displayFeedbackWidget(conversationId);
```

## 2. Feature Usage Tracking

### Feature Tracker Class

Add this to your customer portal:

```javascript
class FeatureUsageTracker {
  constructor() {
    this.adminPortalUrl = 'https://admin-portal-rn5z.onrender.com';
    this.eventQueue = [];
    this.batchInterval = 30000; // Send every 30 seconds
    this.sessionId = this.generateSessionId();
    
    // Start batch sender
    this.startBatchSender();
    
    // Send remaining events before page unload
    window.addEventListener('beforeunload', () => this.sendBatch());
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  track(feature, action, metadata = {}) {
    const customerId = this.getCurrentCustomerId();
    
    if (!customerId) {
      console.warn('Cannot track: no customer ID');
      return;
    }

    const event = {
      customerId,
      userId: this.getCurrentUserId(),
      feature,
      action,
      metadata,
      sessionId: this.sessionId,
      duration: 0, // Can be updated later
      deviceType: this.getDeviceType(),
      browserInfo: navigator.userAgent,
      timestamp: new Date()
    };

    this.eventQueue.push(event);
    console.log(`📊 Tracked: ${feature} - ${action}`);
  }

  async sendBatch() {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const response = await fetch(`${this.adminPortalUrl}/api/statistics/feature-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events })
      });

      if (response.ok) {
        console.log(`✅ Sent ${events.length} feature usage events`);
      } else {
        console.error('❌ Failed to send feature usage events');
        // Re-add to queue if failed
        this.eventQueue.unshift(...events);
      }
    } catch (error) {
      console.error('❌ Error sending feature usage events:', error);
      // Re-add to queue if failed
      this.eventQueue.unshift(...events);
    }
  }

  startBatchSender() {
    setInterval(() => this.sendBatch(), this.batchInterval);
  }

  getCurrentCustomerId() {
    try {
      const customer = JSON.parse(localStorage.getItem('customer') || sessionStorage.getItem('customer') || 'null');
      return customer?._id || customer?.id || null;
    } catch (e) {
      return null;
    }
  }

  getCurrentUserId() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
      return user?._id || user?.id || 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}

// Initialize tracker
window.featureTracker = new FeatureUsageTracker();
```

### Tracking Feature Usage

Add tracking calls throughout your customer portal:

```javascript
// Example: Track invoice viewing
function viewInvoice(invoiceId) {
  window.featureTracker.track('invoicing', 'view', { invoiceId });
  // ... rest of your code
}

// Example: Track invoice creation
function createInvoice(data) {
  window.featureTracker.track('invoicing', 'create', { 
    amount: data.amount,
    currency: data.currency
  });
  // ... rest of your code
}

// Example: Track marketing campaign
function viewMarketingCampaign(platform) {
  const featureMap = {
    google: 'marketing_google',
    meta: 'marketing_meta',
    tiktok: 'marketing_tiktok',
    linkedin: 'marketing_linkedin'
  };
  
  window.featureTracker.track(featureMap[platform] || 'marketing_google', 'view');
}

// Example: Track report generation
function generateReport(reportType) {
  window.featureTracker.track('reports', 'export', { reportType });
}

// Example: Track dashboard view
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/dashboard.html') {
    window.featureTracker.track('dashboard', 'view');
  }
});

// Example: Track settings update
function updateSettings(settingType) {
  window.featureTracker.track('settings', 'update', { settingType });
}

// Example: Track support ticket
function createSupportTicket() {
  window.featureTracker.track('support', 'create');
}
```

## 3. Support Quality Rating

### After Support Case Closed

When a support case is closed, show this rating widget:

```html
<div class="support-rating-modal" id="support-rating-modal" style="display:none;">
  <div class="modal-overlay"></div>
  <div class="modal-content">
    <h3>Hur nöjd är du med supporten?</h3>
    <p>Ditt ärende har stängts. Vi skulle uppskatta din feedback!</p>
    
    <div class="star-rating" id="star-rating">
      <span class="star" data-rating="1">⭐</span>
      <span class="star" data-rating="2">⭐</span>
      <span class="star" data-rating="3">⭐</span>
      <span class="star" data-rating="4">⭐</span>
      <span class="star" data-rating="5">⭐</span>
    </div>
    
    <textarea 
      id="support-feedback-text" 
      placeholder="Valfri feedback om din upplevelse..."
      rows="4"></textarea>
    
    <div class="modal-buttons">
      <button onclick="submitSupportRating()" class="btn-primary">Skicka betyg</button>
      <button onclick="closeSupportRatingModal()" class="btn-secondary">Hoppa över</button>
    </div>
  </div>
</div>

<style>
.support-rating-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  max-width: 500px;
  margin: 100px auto;
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.modal-content h3 {
  margin: 0 0 10px 0;
  color: #333;
}

.modal-content p {
  color: #666;
  margin-bottom: 20px;
}

.star-rating {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 20px 0;
}

.star {
  font-size: 36px;
  cursor: pointer;
  transition: transform 0.2s;
  filter: grayscale(100%);
}

.star:hover,
.star.selected {
  transform: scale(1.2);
  filter: grayscale(0%);
}

.modal-content textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: inherit;
  margin: 15px 0;
}

.modal-buttons {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-secondary {
  background: #ecf0f1;
  color: #333;
}
</style>
```

### JavaScript for Support Rating

```javascript
let currentCaseId = null;
let selectedRating = 0;

// Show rating modal when case is closed
function showSupportRatingModal(caseId) {
  currentCaseId = caseId;
  selectedRating = 0;
  
  document.getElementById('support-rating-modal').style.display = 'block';
  
  // Setup star rating interaction
  const stars = document.querySelectorAll('.star');
  stars.forEach(star => {
    star.addEventListener('click', function() {
      selectedRating = parseInt(this.getAttribute('data-rating'));
      
      // Update visual
      stars.forEach((s, index) => {
        if (index < selectedRating) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    });
  });
}

async function submitSupportRating() {
  if (selectedRating === 0) {
    alert('Vänligen välj ett betyg');
    return;
  }

  const feedbackText = document.getElementById('support-feedback-text').value;
  const customerId = getCurrentCustomerId();

  try {
    const response = await fetch('https://admin-portal-rn5z.onrender.com/api/statistics/support-rating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        caseId: currentCaseId,
        customerId,
        rating: selectedRating,
        feedback: feedbackText
      })
    });

    if (response.ok) {
      console.log('✅ Support rating submitted');
      closeSupportRatingModal();
      showThankYouMessage();
    } else {
      console.error('❌ Failed to submit support rating');
      alert('Ett fel uppstod. Försök igen senare.');
    }
  } catch (error) {
    console.error('❌ Error submitting support rating:', error);
    alert('Ett fel uppstod. Försök igen senare.');
  }
}

function closeSupportRatingModal() {
  document.getElementById('support-rating-modal').style.display = 'none';
  selectedRating = 0;
  document.getElementById('support-feedback-text').value = '';
}

function showThankYouMessage() {
  // Show a toast or notification
  alert('Tack för din feedback! Den hjälper oss att förbättra vår support.');
}

function getCurrentCustomerId() {
  try {
    const customer = JSON.parse(localStorage.getItem('customer') || sessionStorage.getItem('customer') || 'null');
    return customer?._id || customer?.id || null;
  } catch (e) {
    return null;
  }
}
```

## 4. API Endpoint Reference

### POST /api/statistics/ai-feedback
Collect AI assistant feedback.

**Request Body:**
```json
{
  "customerId": "customer_id",
  "question": "User's question",
  "aiResponse": "AI's answer",
  "rating": "positive",
  "category": "helpfulness",
  "feedbackText": "Optional detailed feedback",
  "conversationId": "conv-123",
  "responseTime": 1500,
  "escalatedToHuman": false,
  "resolved": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback saved successfully",
  "feedbackId": "feedback_id"
}
```

### POST /api/statistics/feature-usage
Track feature usage events (batched).

**Request Body:**
```json
{
  "events": [
    {
      "customerId": "customer_id",
      "userId": "user_id",
      "feature": "invoicing",
      "action": "create",
      "metadata": { "amount": 1000 },
      "sessionId": "session-123",
      "duration": 45,
      "deviceType": "desktop",
      "browserInfo": "Mozilla/5.0...",
      "timestamp": "2025-10-10T12:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "5 events saved successfully",
  "saved": 5
}
```

### POST /api/statistics/support-rating
Customer rates support after case closed.

**Request Body:**
```json
{
  "caseId": "case_id",
  "customerId": "customer_id",
  "rating": 5,
  "feedback": "Great support!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rating saved successfully"
}
```

## 5. Best Practices

### Data Privacy
- Only collect necessary data
- Don't track personally identifiable information in metadata
- Respect customer privacy preferences

### Performance
- Batch events to minimize API calls
- Use async/await for non-blocking requests
- Queue events if network is unavailable

### Error Handling
- Always wrap API calls in try-catch
- Log errors for debugging
- Provide fallbacks if tracking fails

### Testing
- Test tracking in dev/staging before production
- Verify data appears in admin statistics dashboard
- Monitor console for tracking errors

## 6. Troubleshooting

### Events not appearing in dashboard
- Check browser console for errors
- Verify customer ID is correct
- Ensure admin portal URL is correct
- Check network tab for failed requests

### High API call volume
- Increase batch interval from 30s to 60s
- Reduce number of tracking calls
- Only track significant user actions

### CORS errors
- Contact admin portal team
- Verify customer portal domain is whitelisted

## Support

For questions or issues with statistics integration, contact the admin portal team.

