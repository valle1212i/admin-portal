// public/js/onboarding-review.js
// Detailed Review Page for Onboarding Applications

let onboardingId = null;
let onboardingData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  onboardingId = urlParams.get('id');
  
  if (!onboardingId) {
    showToast('Ingen onboarding-ID angiven', 'error');
    setTimeout(() => {
      window.location.href = '/onboarding-admin.html';
    }, 2000);
    return;
  }
  
  loadOnboarding();
  initializeEventListeners();
});

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
  document.getElementById('approveBtn').addEventListener('click', approveOnboarding);
  document.getElementById('rejectBtn').addEventListener('click', rejectOnboarding);
  document.getElementById('requestInfoBtn').addEventListener('click', requestInfo);
}

/**
 * Load onboarding data
 */
async function loadOnboarding() {
  try {
    const response = await fetch(`/api/onboarding/${onboardingId}`);
    const result = await response.json();
    
    if (result.success) {
      onboardingData = result.data;
      populateReviewPage(onboardingData);
    } else {
      showToast('Kunde inte ladda onboarding', 'error');
    }
  } catch (error) {
    console.error('Error loading onboarding:', error);
    showToast('Kunde inte ladda onboarding', 'error');
  }
}

/**
 * Populate review page with data
 */
function populateReviewPage(data) {
  // Header
  document.getElementById('companyName').textContent = data.companyName || 'Okänt företag';
  document.getElementById('organizationNumber').textContent = data.organizationNumber || '';
  
  // Status
  const statusLabels = {
    draft: 'Utkast',
    submitted: 'Inskickad',
    in_review: 'Granskas',
    approved: 'Godkänd',
    completed: 'Slutförd',
    rejected: 'Avvisad'
  };
  const statusBadge = document.getElementById('currentStatus');
  statusBadge.textContent = statusLabels[data.onboardingStatus] || data.onboardingStatus;
  statusBadge.className = `status-badge ${data.onboardingStatus}`;
  
  // Company info
  document.getElementById('companyInfo').innerHTML = `
    <div class="info-item">
      <label>Företagsnamn</label>
      <div class="value">${data.companyName || '-'}</div>
    </div>
    <div class="info-item">
      <label>Organisationsnummer</label>
      <div class="value">${data.organizationNumber || '-'}</div>
    </div>
    <div class="info-item">
      <label>Företagsform</label>
      <div class="value">${data.legalEntityType || '-'}</div>
    </div>
    <div class="info-item">
      <label>Registreringsdatum</label>
      <div class="value">${formatDate(data.registrationDate)}</div>
    </div>
    <div class="info-item">
      <label>Webbplats</label>
      <div class="value">${data.website ? `<a href="${data.website}" target="_blank">${data.website}</a>` : '-'}</div>
    </div>
    <div class="info-item">
      <label>Adress</label>
      <div class="value">${formatAddress(data.businessAddress)}</div>
    </div>
    <div class="info-item">
      <label>E-post</label>
      <div class="value">${data.email || '-'}</div>
    </div>
    <div class="info-item">
      <label>Telefon</label>
      <div class="value">${data.phone || '-'}</div>
    </div>
  `;
  
  // Business classification
  document.getElementById('businessInfo').innerHTML = `
    <div class="info-item">
      <label>MCC-kod</label>
      <div class="value">${data.mccCode || '-'}</div>
    </div>
    <div class="info-item">
      <label>SNI-kod</label>
      <div class="value">${data.sniCode || '-'}</div>
    </div>
    <div class="info-item">
      <label>Bransch</label>
      <div class="value">${data.industry || '-'}</div>
    </div>
    <div class="info-item">
      <label>Årlig omsättning</label>
      <div class="value">${data.annualRevenue || '-'}</div>
    </div>
    <div class="info-item" style="grid-column: 1 / -1;">
      <label>Verksamhetsbeskrivning</label>
      <div class="value">${data.businessDescription || '-'}</div>
    </div>
  `;
  
  // Contact person
  document.getElementById('contactInfo').innerHTML = `
    <div class="info-item">
      <label>Namn</label>
      <div class="value">${data.primaryContact?.name || '-'}</div>
    </div>
    <div class="info-item">
      <label>E-post</label>
      <div class="value">${data.primaryContact?.email || '-'}</div>
    </div>
    <div class="info-item">
      <label>Telefon</label>
      <div class="value">${data.primaryContact?.phone || '-'}</div>
    </div>
    <div class="info-item">
      <label>Roll</label>
      <div class="value">${data.primaryContact?.role || '-'}</div>
    </div>
  `;
  
  // Package & pricing
  document.getElementById('packageInfo').innerHTML = `
    <div class="info-item">
      <label>Paket</label>
      <div class="value">${data.package || '-'}</div>
    </div>
    <div class="info-item">
      <label>Faktureringscykel</label>
      <div class="value">${translateBillingFrequency(data.billingFrequency)}</div>
    </div>
    <div class="info-item">
      <label>Månadskostnad</label>
      <div class="value">${data.monthlyPrice ? `${data.monthlyPrice} SEK` : 'Ej beräknad'}</div>
    </div>
    <div class="info-item">
      <label>Första fakturadatum</label>
      <div class="value">${formatDate(data.firstInvoiceDate)}</div>
    </div>
  `;
  
  // Legal
  document.getElementById('legalInfo').innerHTML = `
    <div class="info-item">
      <label>Momsregistrerad</label>
      <div class="value">${data.legal?.vatRegistered ? 'Ja' : 'Nej'}</div>
    </div>
    <div class="info-item">
      <label>Momsnummer</label>
      <div class="value">${data.legal?.vatNumber || '-'}</div>
    </div>
    <div class="info-item">
      <label>F-skatt</label>
      <div class="value">${data.legal?.fSkatt ? 'Ja' : 'Nej'}</div>
    </div>
    <div class="info-item">
      <label>Villkor accepterade</label>
      <div class="value">${data.legal?.termsAccepted ? '✓ Ja' : '✗ Nej'}</div>
    </div>
  `;
  
  // Documents
  const documentsList = document.getElementById('documentsList');
  if (data.verificationDocuments && data.verificationDocuments.length > 0) {
    documentsList.innerHTML = data.verificationDocuments.map(doc => `
      <li class="document-item">
        <div class="doc-info">
          <div class="doc-name">${doc.filename}</div>
          <div class="doc-type">${translateDocType(doc.type)}</div>
        </div>
        <a href="${doc.fileUrl}" target="_blank" class="btn-download">Visa</a>
      </li>
    `).join('');
  } else {
    documentsList.innerHTML = '<li style="color: #6b7280; padding: 20px; text-align: center;">Inga dokument uppladdade</li>';
  }
  
  // Admin notes
  document.getElementById('adminNotes').value = data.adminNotes || '';
  
  // Metadata
  document.getElementById('createdAt').textContent = formatDate(data.createdAt);
  document.getElementById('submittedAt').textContent = formatDate(data.onboardingSubmitted);
  document.getElementById('assignedTo').textContent = data.assignedTo || 'Ej tilldelad';
  
  // Disable actions if already completed
  if (data.onboardingStatus === 'completed' || data.onboardingStatus === 'approved') {
    document.getElementById('approveBtn').disabled = true;
    document.getElementById('rejectBtn').disabled = true;
    document.getElementById('approveBtn').textContent = 'Redan godkänd';
  }
}

/**
 * Approve onboarding
 */
async function approveOnboarding() {
  if (!confirm('Är du säker på att du vill godkänna denna ansökan? Detta kommer att skapa ett kundkonto och skicka inloggningsuppgifter via e-post.')) {
    return;
  }
  
  const notes = document.getElementById('adminNotes').value;
  
  try {
    const response = await fetch(`/api/onboarding/${onboardingId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvedBy: 'Admin',
        notes
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Onboarding godkänd! Kundkonto skapat och mejl skickat.', 'success');
      setTimeout(() => {
        window.location.href = '/onboarding-admin.html';
      }, 2000);
    } else {
      showToast('Kunde inte godkänna: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error approving:', error);
    showToast('Kunde inte godkänna onboarding', 'error');
  }
}

/**
 * Reject onboarding
 */
async function rejectOnboarding() {
  const reason = prompt('Ange orsak för avvisning (skickas till kunden via e-post):');
  if (!reason) return;
  
  try {
    const response = await fetch(`/api/onboarding/${onboardingId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rejectedBy: 'Admin',
        reason
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Onboarding avvisad och mejl skickat till kunden', 'success');
      setTimeout(() => {
        window.location.href = '/onboarding-admin.html';
      }, 2000);
    } else {
      showToast('Kunde inte avvisa: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error rejecting:', error);
    showToast('Kunde inte avvisa onboarding', 'error');
  }
}

/**
 * Request more information
 */
async function requestInfo() {
  const message = prompt('Vilket meddelande vill du skicka till kunden?');
  if (!message) return;
  
  try {
    const response = await fetch(`/api/onboarding/${onboardingId}/request-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestedBy: 'Admin',
        message
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Förfrågan skickad till kunden', 'success');
      loadOnboarding();
    } else {
      showToast('Kunde inte skicka förfrågan: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error requesting info:', error);
    showToast('Kunde inte skicka förfrågan', 'error');
  }
}

/**
 * Helper functions
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatAddress(address) {
  if (!address) return '-';
  return `${address.street || ''}, ${address.postalCode || ''} ${address.city || ''}, ${address.country || ''}`.trim();
}

function translateBillingFrequency(freq) {
  const translations = {
    monthly: 'Månadsvis',
    quarterly: 'Kvartalsvis',
    annually: 'Årsvis'
  };
  return translations[freq] || freq || '-';
}

function translateDocType(type) {
  const translations = {
    registration_certificate: 'Registreringsbevis',
    id_document: 'ID-handling',
    bank_certificate: 'Bankintyg',
    f_skatt_certificate: 'F-skattsedel'
  };
  return translations[type] || type;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const messageSpan = toast.querySelector('.toast-message');
  
  messageSpan.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

