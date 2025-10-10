// public/js/onboarding.js
// Customer Onboarding Form Logic

let currentStep = 1;
const totalSteps = 10;
let onboardingId = null;
let autosaveTimer = null;
let formData = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're editing an existing onboarding
  const urlParams = new URLSearchParams(window.location.search);
  onboardingId = urlParams.get('id');
  
  if (onboardingId) {
    loadOnboarding(onboardingId);
  } else {
    loadFromLocalStorage();
  }
  
  initializeEventListeners();
  updateProgress();
  startAutosave();
});

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Navigation buttons
  document.getElementById('prevStepBtn').addEventListener('click', previousStep);
  document.getElementById('nextStepBtn').addEventListener('click', nextStep);
  document.getElementById('saveDraftBtn').addEventListener('click', saveDraft);
  document.getElementById('submitOnboardingBtn').addEventListener('click', submitOnboarding);
  
  // Organization number lookup
  document.getElementById('lookupOrgBtn').addEventListener('click', lookupOrganization);
  
  // Billing address toggle
  document.getElementById('sameBillingAddress').addEventListener('click', toggleBillingAddress);
  
  // Business description character count
  document.getElementById('businessDescription').addEventListener('input', updateCharCount);
  
  // MCC code other option
  document.getElementById('mccCode').addEventListener('change', toggleMCCCustom);
  
  // Package selection
  document.querySelectorAll('.btn-package').forEach(btn => {
    btn.addEventListener('click', selectPackage);
  });
  
  // Billing frequency change
  document.getElementById('billingFrequency').addEventListener('change', calculatePricing);
  
  // Additional services change
  document.querySelectorAll('input[name="additionalServices"]').forEach(checkbox => {
    checkbox.addEventListener('change', calculatePricing);
  });
  
  // Add user button
  document.getElementById('addUserBtn').addEventListener('click', addUser);
  
  // VAT registered toggle
  document.getElementById('vatRegistered').addEventListener('change', toggleVATNumber);
  
  // Terms/Privacy modals
  document.getElementById('viewTerms')?.addEventListener('click', (e) => {
    e.preventDefault();
    showModal('terms');
  });
  document.getElementById('viewPrivacy')?.addEventListener('click', (e) => {
    e.preventDefault();
    showModal('privacy');
  });
  
  // File upload dropzones
  initializeFileUploads();
  
  // Review edit buttons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const step = parseInt(e.target.dataset.gotoStep);
      goToStep(step);
    });
  });
  
  // Modal close
  document.querySelector('.modal-close')?.addEventListener('click', closeModal);
}

/**
 * Navigate to next step
 */
async function nextStep() {
  if (!validateCurrentStep()) {
    showToast('Vänligen fyll i alla obligatoriska fält', 'error');
    return;
  }
  
  if (currentStep < totalSteps) {
    currentStep++;
    showStep(currentStep);
    updateProgress();
    saveToLocalStorage();
  }
}

/**
 * Navigate to previous step
 */
function previousStep() {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
    updateProgress();
  }
}

/**
 * Go to specific step
 */
function goToStep(step) {
  if (step >= 1 && step <= totalSteps) {
    currentStep = step;
    showStep(currentStep);
    updateProgress();
  }
}

/**
 * Show specific step
 */
function showStep(step) {
  // Hide all steps
  document.querySelectorAll('.step').forEach(s => {
    s.style.display = 'none';
  });
  
  // Show current step
  const stepElement = document.querySelector(`.step[data-step="${step}"]`);
  if (stepElement) {
    stepElement.style.display = 'block';
  }
  
  // Update navigation buttons
  document.getElementById('prevStepBtn').disabled = step === 1;
  
  if (step === totalSteps) {
    document.getElementById('nextStepBtn').style.display = 'none';
    document.getElementById('submitOnboardingBtn').style.display = 'inline-block';
    populateReview();
  } else {
    document.getElementById('nextStepBtn').style.display = 'inline-block';
    document.getElementById('submitOnboardingBtn').style.display = 'none';
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Update progress bar
 */
function updateProgress() {
  const progress = (currentStep / totalSteps) * 100;
  document.getElementById('progressFill').style.width = `${progress}%`;
  
  // Update step indicators
  document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
    const stepNum = index + 1;
    if (stepNum < currentStep) {
      indicator.classList.add('completed');
      indicator.classList.remove('active');
    } else if (stepNum === currentStep) {
      indicator.classList.add('active');
      indicator.classList.remove('completed');
    } else {
      indicator.classList.remove('active', 'completed');
    }
  });
}

/**
 * Validate current step
 */
function validateCurrentStep() {
  const currentStepElement = document.querySelector(`.step[data-step="${currentStep}"]`);
  const requiredFields = currentStepElement.querySelectorAll('[required]');
  
  let isValid = true;
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      field.classList.add('error');
      isValid = false;
    } else {
      field.classList.remove('error');
    }
  });
  
  // Special validation for step 5 (package selection)
  if (currentStep === 5) {
    const selectedPackage = document.getElementById('selectedPackage').value;
    if (!selectedPackage) {
      showToast('Välj ett paket', 'error');
      return false;
    }
  }
  
  // Special validation for step 8 (legal)
  if (currentStep === 8) {
    const termsAccepted = document.getElementById('termsAccepted').checked;
    const privacyAccepted = document.getElementById('privacyAccepted').checked;
    const gdprConsent = document.getElementById('gdprConsent').checked;
    
    if (!termsAccepted || !privacyAccepted || !gdprConsent) {
      showToast('Du måste acceptera alla obligatoriska villkor', 'error');
      return false;
    }
  }
  
  return isValid;
}

/**
 * Collect form data
 */
function collectFormData() {
  const data = {};
  
  // Get all form inputs
  const inputs = document.querySelectorAll('input, select, textarea');
  
  inputs.forEach(input => {
    const name = input.name || input.id;
    if (!name) return;
    
    if (input.type === 'checkbox') {
      if (input.name.includes('[') || name.includes('preferredPaymentMethods') || name.includes('marketingTools') || name.includes('additionalServices')) {
        // Handle arrays
        if (!data[name.split('[')[0]]) {
          data[name.split('[')[0]] = [];
        }
        if (input.checked) {
          data[name.split('[')[0]].push(input.value);
        }
      } else {
        data[name] = input.checked;
      }
    } else if (input.type === 'radio') {
      if (input.checked) {
        data[name] = input.value;
      }
    } else {
      data[name] = input.value;
    }
  });
  
  // Handle nested objects (e.g., primaryContact.name)
  const nestedData = {};
  Object.keys(data).forEach(key => {
    if (key.includes('.')) {
      const parts = key.split('.');
      if (!nestedData[parts[0]]) {
        nestedData[parts[0]] = {};
      }
      nestedData[parts[0]][parts[1]] = data[key];
      delete data[key];
    }
  });
  
  Object.assign(data, nestedData);
  
  return data;
}

/**
 * Save draft to server
 */
async function saveDraft() {
  const data = collectFormData();
  
  try {
    const response = await fetch('/api/onboarding/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        onboardingId,
        step: currentStep,
        data
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      onboardingId = result.onboardingId;
      showToast('Utkast sparat', 'success');
      updateAutosaveIndicator('Sparad');
      
      // Update URL with onboarding ID
      if (!window.location.search.includes('id=')) {
        window.history.replaceState({}, '', `?id=${onboardingId}`);
      }
    } else {
      showToast('Kunde inte spara utkast: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error saving draft:', error);
    showToast('Kunde inte spara utkast', 'error');
  }
}

/**
 * Auto-save every 30 seconds
 */
function startAutosave() {
  autosaveTimer = setInterval(async () => {
    if (onboardingId) {
      const data = collectFormData();
      
      try {
        updateAutosaveIndicator('Sparar...');
        
        const response = await fetch(`/api/onboarding/${onboardingId}/autosave`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: currentStep, data })
        });
        
        const result = await response.json();
        
        if (result.success) {
          updateAutosaveIndicator('Sparad');
        }
      } catch (error) {
        console.error('Auto-save error:', error);
        updateAutosaveIndicator('Fel vid sparning');
      }
    }
  }, 30000); // 30 seconds
}

/**
 * Update autosave indicator
 */
function updateAutosaveIndicator(status) {
  const indicator = document.getElementById('autosaveIndicator');
  const statusSpan = indicator.querySelector('.status');
  statusSpan.textContent = status;
  
  indicator.className = 'autosave-indicator';
  if (status === 'Sparad') {
    indicator.classList.add('saved');
  } else if (status === 'Sparar...') {
    indicator.classList.add('saving');
  } else if (status.includes('Fel')) {
    indicator.classList.add('error');
  }
}

/**
 * Submit onboarding
 */
async function submitOnboarding() {
  if (!onboardingId) {
    showToast('Spara först ett utkast', 'error');
    return;
  }
  
  if (!confirm('Är du säker på att du vill skicka in denna ansökan? Kunden kommer att få ett bekräftelsemail.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/onboarding/${onboardingId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Ansökan inskickad! Kunden har fått ett bekräftelsemail.', 'success');
      setTimeout(() => {
        window.location.href = '/onboarding-admin.html';
      }, 2000);
    } else {
      showToast('Kunde inte skicka in: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error submitting:', error);
    showToast('Kunde inte skicka in ansökan', 'error');
  }
}

/**
 * Load existing onboarding
 */
async function loadOnboarding(id) {
  try {
    const response = await fetch(`/api/onboarding/${id}`);
    const result = await response.json();
    
    if (result.success) {
      populateForm(result.data);
      currentStep = result.data.currentStep || 1;
      showStep(currentStep);
      updateProgress();
    } else {
      showToast('Kunde inte ladda onboarding', 'error');
    }
  } catch (error) {
    console.error('Error loading onboarding:', error);
    showToast('Kunde inte ladda onboarding', 'error');
  }
}

/**
 * Populate form with data
 */
function populateForm(data) {
  Object.keys(data).forEach(key => {
    const input = document.querySelector(`[name="${key}"], #${key}`);
    if (input) {
      if (input.type === 'checkbox') {
        input.checked = data[key];
      } else if (input.type === 'radio') {
        if (input.value === data[key]) {
          input.checked = true;
        }
      } else {
        input.value = data[key];
      }
    }
  });
  
  // Handle nested objects
  if (data.primaryContact) {
    Object.keys(data.primaryContact).forEach(key => {
      const input = document.querySelector(`[name="primaryContact.${key}"]`);
      if (input) {
        input.value = data.primaryContact[key];
      }
    });
  }
  
  if (data.package) {
    document.getElementById('selectedPackage').value = data.package;
    highlightSelectedPackage(data.package);
  }
  
  calculatePricing();
}

/**
 * Organization number lookup
 */
async function lookupOrganization() {
  const orgNumber = document.getElementById('organizationNumber').value;
  
  if (!orgNumber) {
    showToast('Ange organisationsnummer', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/onboarding/validate/orgnr/${orgNumber}`);
    const result = await response.json();
    
    if (result.success && result.data) {
      // Auto-fill company data
      document.getElementById('companyName').value = result.data.companyName || '';
      document.getElementById('legalEntityType').value = result.data.legalEntityType || '';
      document.getElementById('registrationDate').value = result.data.registrationDate || '';
      
      if (result.data.address) {
        document.getElementById('businessStreet').value = result.data.address.street || '';
        document.getElementById('businessPostalCode').value = result.data.address.postalCode || '';
        document.getElementById('businessCity').value = result.data.address.city || '';
        document.getElementById('businessCountry').value = result.data.address.country || 'Sverige';
      }
      
      showToast('Företagsuppgifter hämtade', 'success');
    } else {
      showToast('Kunde inte hitta företag', 'warning');
    }
  } catch (error) {
    console.error('Error looking up organization:', error);
    showToast('Kunde inte hämta företagsuppgifter', 'error');
  }
}

/**
 * Toggle billing address fields
 */
function toggleBillingAddress() {
  const isChecked = document.getElementById('sameBillingAddress').checked;
  const billingFields = document.getElementById('billingAddressFields');
  billingFields.style.display = isChecked ? 'none' : 'block';
}

/**
 * Update character count for business description
 */
function updateCharCount() {
  const textarea = document.getElementById('businessDescription');
  const charCount = document.getElementById('charCount');
  charCount.textContent = textarea.value.length;
}

/**
 * Toggle MCC code custom input
 */
function toggleMCCCustom() {
  const mccCode = document.getElementById('mccCode').value;
  const customGroup = document.getElementById('mccCodeCustomGroup');
  customGroup.style.display = mccCode === 'other' ? 'block' : 'none';
}

/**
 * Select package
 */
function selectPackage(e) {
  const packageName = e.target.dataset.package;
  document.getElementById('selectedPackage').value = packageName;
  
  highlightSelectedPackage(packageName);
  calculatePricing();
  updateUserLimit(packageName);
}

/**
 * Highlight selected package card
 */
function highlightSelectedPackage(packageName) {
  document.querySelectorAll('.package-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  const selectedCard = document.querySelector(`.package-card[data-package="${packageName}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
}

/**
 * Calculate pricing
 */
async function calculatePricing() {
  const packageName = document.getElementById('selectedPackage').value;
  const billingFrequency = document.getElementById('billingFrequency').value;
  const additionalServices = Array.from(document.querySelectorAll('input[name="additionalServices"]:checked'))
    .map(cb => cb.value);
  
  if (!packageName) return;
  
  try {
    const response = await fetch('/api/onboarding/calculate-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: packageName, billingFrequency, additionalServices })
    });
    
    const result = await response.json();
    
    if (result.success) {
      const pricing = result.pricing;
      
      document.getElementById('summaryBasePrice').textContent = `${pricing.basePrice} SEK`;
      document.getElementById('summaryAddOns').textContent = `${pricing.addOnsPrice} SEK`;
      document.getElementById('summaryTotal').textContent = `${pricing.totalPrice} SEK`;
      
      if (pricing.discount > 0) {
        document.getElementById('summaryDiscount').style.display = 'flex';
        document.getElementById('summaryDiscountAmount').textContent = `${pricing.discount}%`;
      } else {
        document.getElementById('summaryDiscount').style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error calculating price:', error);
  }
}

/**
 * Update user limit based on package
 */
function updateUserLimit(packageName) {
  const limits = {
    'Bas': 2,
    'Grower': 5,
    'Enterprise': 20
  };
  
  const limit = limits[packageName] || 0;
  document.getElementById('userLimitText').textContent = limit;
}

/**
 * Add user to list
 */
function addUser() {
  const packageName = document.getElementById('selectedPackage').value;
  const limits = { 'Bas': 2, 'Grower': 5, 'Enterprise': 20 };
  const maxUsers = limits[packageName] || 2;
  
  const currentUsers = document.querySelectorAll('.user-card').length;
  
  if (currentUsers >= maxUsers) {
    showToast(`Du kan max ha ${maxUsers} användare med ${packageName}-paketet`, 'warning');
    return;
  }
  
  const userIndex = currentUsers;
  const userCard = document.createElement('div');
  userCard.className = 'user-card';
  userCard.dataset.userIndex = userIndex;
  userCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h4>Användare ${userIndex + 1}</h4>
      <button type="button" class="btn-remove" onclick="removeUser(${userIndex})">Ta bort</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Namn</label>
        <input type="text" name="initialUsers[${userIndex}].name" required>
      </div>
      <div class="form-group">
        <label>E-post</label>
        <input type="email" name="initialUsers[${userIndex}].email" required>
      </div>
      <div class="form-group">
        <label>Telefon</label>
        <input type="tel" name="initialUsers[${userIndex}].phone">
      </div>
      <div class="form-group">
        <label>Roll</label>
        <select name="initialUsers[${userIndex}].role">
          <option value="User">Användare</option>
          <option value="Admin">Admin</option>
          <option value="Viewer">Läsare</option>
        </select>
      </div>
    </div>
  `;
  
  document.getElementById('usersList').appendChild(userCard);
}

/**
 * Remove user from list
 */
function removeUser(index) {
  const userCard = document.querySelector(`.user-card[data-user-index="${index}"]`);
  if (userCard) {
    userCard.remove();
  }
}

/**
 * Toggle VAT number field
 */
function toggleVATNumber() {
  const isChecked = document.getElementById('vatRegistered').checked;
  const vatGroup = document.getElementById('vatNumberGroup');
  vatGroup.style.display = isChecked ? 'block' : 'none';
}

/**
 * Initialize file upload dropzones
 */
function initializeFileUploads() {
  document.querySelectorAll('.file-dropzone').forEach(dropzone => {
    const input = dropzone.querySelector('input[type="file"]');
    const content = dropzone.querySelector('.dropzone-content');
    const preview = dropzone.querySelector('.file-preview');
    
    // Click to select file
    content.addEventListener('click', () => input.click());
    
    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        input.files = files;
        handleFileUpload(input, dropzone);
      }
    });
    
    // File input change
    input.addEventListener('change', () => {
      handleFileUpload(input, dropzone);
    });
  });
}

/**
 * Handle file upload
 */
async function handleFileUpload(input, dropzone) {
  const file = input.files[0];
  if (!file) return;
  
  const documentType = dropzone.dataset.documentType;
  const content = dropzone.querySelector('.dropzone-content');
  const preview = dropzone.querySelector('.file-preview');
  
  // Show preview
  content.style.display = 'none';
  preview.style.display = 'block';
  preview.innerHTML = `
    <p><strong>${file.name}</strong></p>
    <p>${(file.size / 1024 / 1024).toFixed(2)} MB</p>
    <p class="uploading">Laddar upp...</p>
  `;
  
  if (!onboardingId) {
    preview.querySelector('.uploading').textContent = 'Spara utkast först för att ladda upp filer';
    return;
  }
  
  // Upload file
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  
  try {
    const response = await fetch(`/api/onboarding/${onboardingId}/upload-document`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      preview.querySelector('.uploading').textContent = '✓ Uppladdat';
      preview.querySelector('.uploading').classList.add('success');
    } else {
      preview.querySelector('.uploading').textContent = '✗ Fel: ' + result.message;
      preview.querySelector('.uploading').classList.add('error');
    }
  } catch (error) {
    console.error('Upload error:', error);
    preview.querySelector('.uploading').textContent = '✗ Uppladdning misslyckades';
    preview.querySelector('.uploading').classList.add('error');
  }
}

/**
 * Populate review step
 */
function populateReview() {
  const data = collectFormData();
  
  // Company info
  const reviewCompany = document.getElementById('reviewCompany');
  reviewCompany.innerHTML = `
    <dt>Organisationsnummer:</dt><dd>${data.organizationNumber || '-'}</dd>
    <dt>Företagsnamn:</dt><dd>${data.companyName || '-'}</dd>
    <dt>Företagsform:</dt><dd>${data.legalEntityType || '-'}</dd>
    <dt>Adress:</dt><dd>${data['businessAddress.street'] || ''}, ${data['businessAddress.postalCode'] || ''} ${data['businessAddress.city'] || ''}</dd>
    <dt>E-post:</dt><dd>${data.email || '-'}</dd>
    <dt>Telefon:</dt><dd>${data.phone || '-'}</dd>
  `;
  
  // Contact person
  const reviewContact = document.getElementById('reviewContact');
  reviewContact.innerHTML = `
    <dt>Namn:</dt><dd>${data['primaryContact.name'] || '-'}</dd>
    <dt>E-post:</dt><dd>${data['primaryContact.email'] || '-'}</dd>
    <dt>Telefon:</dt><dd>${data['primaryContact.phone'] || '-'}</dd>
    <dt>Roll:</dt><dd>${data['primaryContact.role'] || '-'}</dd>
  `;
  
  // Package
  const reviewPackage = document.getElementById('reviewPackage');
  reviewPackage.innerHTML = `
    <dt>Paket:</dt><dd>${data.package || '-'}</dd>
    <dt>Faktureringscykel:</dt><dd>${data.billingFrequency === 'monthly' ? 'Månadsvis' : data.billingFrequency === 'quarterly' ? 'Kvartalsvis' : 'Årsvis'}</dd>
    <dt>Total kostnad:</dt><dd>${document.getElementById('summaryTotal').textContent}</dd>
  `;
  
  // Users
  const users = document.querySelectorAll('.user-card');
  const reviewUsers = document.getElementById('reviewUsers');
  reviewUsers.innerHTML = `<dt>Antal användare:</dt><dd>${users.length}</dd>`;
  
  // Documents
  const documents = document.querySelectorAll('.file-preview:not([style*="display: none"])');
  const reviewDocuments = document.getElementById('reviewDocuments');
  reviewDocuments.innerHTML = `<dt>Uppladdade dokument:</dt><dd>${documents.length} fil(er)</dd>`;
}

/**
 * Show modal
 */
function showModal(type) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  
  if (type === 'terms') {
    modalBody.innerHTML = '<h2>Användarvillkor</h2><p>Här kommer användarvillkoren att visas...</p>';
  } else if (type === 'privacy') {
    modalBody.innerHTML = '<h2>Integritetspolicy</h2><p>Här kommer integritetspolicyn att visas...</p>';
  }
  
  modal.style.display = 'flex';
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

/**
 * Show toast notification
 */
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

/**
 * Save to localStorage (backup)
 */
function saveToLocalStorage() {
  const data = collectFormData();
  localStorage.setItem('onboarding_backup', JSON.stringify({
    step: currentStep,
    data,
    timestamp: Date.now()
  }));
}

/**
 * Load from localStorage
 */
function loadFromLocalStorage() {
  const backup = localStorage.getItem('onboarding_backup');
  if (backup) {
    try {
      const parsed = JSON.parse(backup);
      const hourAgo = Date.now() - (60 * 60 * 1000);
      
      if (parsed.timestamp > hourAgo) {
        if (confirm('Det finns ett sparat utkast. Vill du fortsätta där du slutade?')) {
          populateForm(parsed.data);
          currentStep = parsed.step || 1;
          showStep(currentStep);
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }
}

// Auto-fill primary admin user from contact person when moving to step 6
document.addEventListener('DOMContentLoaded', () => {
  const observer = new MutationObserver(() => {
    if (currentStep === 6) {
      const contactName = document.getElementById('contactName').value;
      const contactEmail = document.getElementById('contactEmail').value;
      const contactPhone = document.getElementById('contactPhone').value;
      
      const adminNameInput = document.querySelector('input[name="initialUsers[0].name"]');
      const adminEmailInput = document.querySelector('input[name="initialUsers[0].email"]');
      const adminPhoneInput = document.querySelector('input[name="initialUsers[0].phone"]');
      
      if (adminNameInput && !adminNameInput.value) adminNameInput.value = contactName;
      if (adminEmailInput && !adminEmailInput.value) adminEmailInput.value = contactEmail;
      if (adminPhoneInput && !adminPhoneInput.value) adminPhoneInput.value = contactPhone;
    }
  });
  
  observer.observe(document.querySelector('.onboarding-steps'), { childList: true, subtree: true });
});

