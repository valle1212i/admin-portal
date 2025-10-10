// Avtal Management JavaScript

let currentCustomerId = null;
let currentContractId = null;
let searchTimeout = null;

// Get current admin email (you may need to adjust this based on your auth system)
function getCurrentAdminEmail() {
  // TODO: Get from session/localStorage or API
  return 'korpela.valentin@gmail.com'; // Default for testing
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupSearch();
  setupPackageChangeButton();
  setupTerminationButton();
  setupUploadButton();
});

// ===================================
// SEARCH FUNCTIONALITY
// ===================================

function setupSearch() {
  const searchInput = document.getElementById('customer-search');
  const searchResults = document.getElementById('search-results');

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (query.length < 2) {
      searchResults.classList.remove('active');
      searchResults.innerHTML = '';
      return;
    }

    searchTimeout = setTimeout(() => searchCustomers(query), 300);
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-wrapper')) {
      searchResults.classList.remove('active');
    }
  });
}

async function searchCustomers(query) {
  try {
    const res = await fetch(`/api/contracts/search/customers?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.success) {
      displaySearchResults(data.customers);
    }
  } catch (err) {
    console.error('Search error:', err);
  }
}

function displaySearchResults(customers) {
  const searchResults = document.getElementById('search-results');

  if (customers.length === 0) {
    searchResults.innerHTML = '<div class="empty-state"><p>Inga kunder hittades</p></div>';
    searchResults.classList.add('active');
    return;
  }

  searchResults.innerHTML = customers.map(customer => `
    <div class="search-result-item" onclick="selectCustomer('${customer._id}')">
      <div class="search-result-name">${customer.name || 'Namnlös'}</div>
      <div class="search-result-email">${customer.email || 'Ingen e-post'}</div>
      <div class="search-result-badges">
        <span class="badge package-${customer.package || 'Bas'}">${customer.package || 'Bas'}</span>
        <span class="badge status-${customer.agreementStatus || 'active'}">${formatAgreementStatus(customer.agreementStatus)}</span>
      </div>
    </div>
  `).join('');

  searchResults.classList.add('active');
}

function formatAgreementStatus(status) {
  const statusMap = {
    'active': 'Aktiv',
    'terminated': 'Uppsagd',
    'read_only': 'Läsläge'
  };
  return statusMap[status] || 'Aktiv';
}

async function selectCustomer(customerId) {
  currentCustomerId = customerId;
  document.getElementById('search-results').classList.remove('active');
  await loadCustomerDetails(customerId);
  document.getElementById('customer-details').style.display = 'grid';
}

// ===================================
// CUSTOMER DETAILS
// ===================================

async function loadCustomerDetails(customerId) {
  try {
    const res = await fetch(`/api/contracts/customer/${customerId}/details`);
    const data = await res.json();

    if (data.success) {
      displayCustomerInfo(data.customer);
      displayContracts(data.contracts);
      displayPendingRequests(data.customer.packageChangeRequests);
      displayTerminationStatus(data.customer);
    }
  } catch (err) {
    console.error('Error loading customer details:', err);
  }
}

function displayCustomerInfo(customer) {
  document.getElementById('customer-name').textContent = customer.name || 'Namnlös';
  document.getElementById('customer-email').textContent = customer.email || 'Ingen e-post';
  
  // Agreement status badge
  const statusBadge = document.getElementById('agreement-status-badge');
  statusBadge.textContent = formatAgreementStatus(customer.agreementStatus);
  statusBadge.className = `badge status-${customer.agreementStatus || 'active'}`;
  
  // Package badge
  const packageBadge = document.getElementById('current-package-badge');
  packageBadge.textContent = customer.package || 'Bas';
  packageBadge.className = `badge package-badge package-${customer.package || 'Bas'}`;
  
  // User count badge
  const userCountBadge = document.getElementById('user-count-badge');
  userCountBadge.textContent = `${customer.currentUserCount || 1}/${customer.maxUsers || 2} användare`;
  
  // Package info
  document.getElementById('current-package-text').textContent = customer.package || 'Bas';
  document.getElementById('max-users-text').textContent = customer.maxUsers || 2;
  document.getElementById('current-users-text').textContent = customer.currentUserCount || 1;
  
  // Set package select to current package
  document.getElementById('package-select').value = customer.package || 'Bas';
}

function displayContracts(contracts) {
  const contractsList = document.getElementById('contracts-list');

  if (contracts.length === 0) {
    contractsList.innerHTML = '<div class="empty-state"><h3>Inga avtal hittades</h3><p>Ladda upp ett avtal för att komma igång</p></div>';
    return;
  }

  contractsList.innerHTML = contracts.map(contract => `
    <div class="contract-item">
      <div class="contract-header">
        <div>
          <div class="contract-filename">${contract.filename}</div>
          <div class="contract-meta">
            Uppladdad: ${formatDate(contract.uploadedAt)} | Status: ${contract.status}
            ${contract.packageType ? ` | Paket: ${contract.packageType}` : ''}
          </div>
        </div>
        <span class="badge">${contract.status}</span>
      </div>
      
      <div class="contract-actions">
        <button class="btn-small" onclick="downloadContractPDF('${contract._id}')">Ladda ner PDF</button>
        <button class="btn-small btn-secondary" onclick="openAddDocumentModal('${contract._id}')">Lägg till dokument</button>
      </div>
      
      ${contract.additionalDocuments && contract.additionalDocuments.length > 0 ? `
        <div class="additional-documents">
          <div class="additional-documents-title">Ytterligare dokument:</div>
          ${contract.additionalDocuments.map(doc => `
            <div class="additional-document">
              <a href="${doc.fileUrl}" target="_blank">${doc.name}</a> - ${formatDate(doc.uploadedAt)}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

function displayPendingRequests(requests) {
  const pendingRequestsDiv = document.getElementById('pending-requests');
  
  if (!requests || requests.length === 0) {
    pendingRequestsDiv.innerHTML = '';
    return;
  }

  // Filter to show only pending requests
  const pending = requests.filter(r => r.status === 'pending');
  
  if (pending.length === 0) {
    pendingRequestsDiv.innerHTML = '';
    return;
  }

  pendingRequestsDiv.innerHTML = `
    <h4 style="margin: 1.5rem 0 1rem 0; font-size: 1rem; color: var(--text-primary);">Väntande begäranden</h4>
    ${pending.map(request => `
      <div class="request-item">
        <div class="request-header">
          <div class="request-title">Ändring till ${request.requestedPackage}</div>
          <span class="request-status ${request.status}">${formatRequestStatus(request.status)}</span>
        </div>
        <div class="request-details">
          Begärt av: ${request.requestedBy}<br>
          Datum: ${formatDate(request.requestedAt)}<br>
          Träder i kraft: ${request.effectiveDate === 'immediate' ? 'Omedelbart' : 'Nästa faktureringscykel'}
        </div>
        <div class="request-actions">
          <button class="btn-small" onclick="approvePackageChange('${request._id}')">Godkänn</button>
          <button class="btn-small btn-secondary" onclick="rejectPackageChange('${request._id}')">Avslå</button>
        </div>
      </div>
    `).join('')}
  `;
}

function displayTerminationStatus(customer) {
  const terminationCard = document.getElementById('termination-card');
  const terminationStatusCard = document.getElementById('termination-status-card');

  if (customer.agreementStatus === 'terminated' || customer.terminationDate) {
    terminationCard.style.display = 'none';
    terminationStatusCard.style.display = 'block';
    
    document.getElementById('termination-date').textContent = formatDate(customer.terminationDate);
    document.getElementById('termination-effective-date').textContent = formatDate(customer.terminationEffectiveDate);
    document.getElementById('data-retention-date').textContent = formatDate(customer.dataRetentionUntil);
    document.getElementById('termination-reason').textContent = customer.terminationReason || 'Ej angiven';
  } else {
    terminationCard.style.display = 'block';
    terminationStatusCard.style.display = 'none';
  }
}

function formatRequestStatus(status) {
  const statusMap = {
    'pending': 'Väntande',
    'approved': 'Godkänd',
    'rejected': 'Avslagen'
  };
  return statusMap[status] || status;
}

function formatDate(dateString) {
  if (!dateString) return 'Ej angivet';
  const date = new Date(dateString);
  return date.toLocaleDateString('sv-SE');
}

// ===================================
// PACKAGE MANAGEMENT
// ===================================

function setupPackageChangeButton() {
  document.getElementById('request-package-change').addEventListener('click', requestPackageChange);
}

async function requestPackageChange() {
  if (!currentCustomerId) return;

  const newPackage = document.getElementById('package-select').value;
  const effectiveDate = document.getElementById('effective-date').value;
  const requestedBy = getCurrentAdminEmail();

  try {
    const res = await fetch(`/api/contracts/customer/${currentCustomerId}/change-package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPackage, effectiveDate, requestedBy })
    });

    const data = await res.json();

    if (data.success) {
      alert('Paketändring begärd!');
      await loadCustomerDetails(currentCustomerId);
    } else {
      alert('Fel: ' + data.message);
    }
  } catch (err) {
    console.error('Error requesting package change:', err);
    alert('Ett fel uppstod vid begäran om paketändring');
  }
}

async function approvePackageChange(requestId) {
  if (!currentCustomerId) return;

  const approvedBy = getCurrentAdminEmail();

  try {
    const res = await fetch(`/api/contracts/package-change/${currentCustomerId}/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy })
    });

    const data = await res.json();

    if (data.success) {
      alert('Paketändring godkänd!');
      await loadCustomerDetails(currentCustomerId);
    } else {
      alert('Fel: ' + data.message);
    }
  } catch (err) {
    console.error('Error approving package change:', err);
    alert('Ett fel uppstod vid godkännande');
  }
}

async function rejectPackageChange(requestId) {
  if (!currentCustomerId) return;

  const reason = prompt('Anledning till avslag (valfritt):');
  const rejectedBy = getCurrentAdminEmail();

  try {
    const res = await fetch(`/api/contracts/package-change/${currentCustomerId}/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectedBy, reason })
    });

    const data = await res.json();

    if (data.success) {
      alert('Paketändring avslagen');
      await loadCustomerDetails(currentCustomerId);
    } else {
      alert('Fel: ' + data.message);
    }
  } catch (err) {
    console.error('Error rejecting package change:', err);
    alert('Ett fel uppstod vid avslag');
  }
}

// ===================================
// TERMINATION
// ===================================

function setupTerminationButton() {
  document.getElementById('terminate-agreement').addEventListener('click', openTerminationModal);
}

function openTerminationModal() {
  const customerName = document.getElementById('customer-name').textContent;
  document.getElementById('term-customer-name').textContent = customerName;
  document.getElementById('termination-modal').style.display = 'flex';
}

function closeTerminationModal() {
  document.getElementById('termination-modal').style.display = 'none';
  document.getElementById('termination-reason').value = '';
}

async function confirmTermination() {
  if (!currentCustomerId) return;

  const reason = document.getElementById('termination-reason').value.trim();
  if (!reason) {
    alert('Vänligen ange en anledning för uppsägningen');
    return;
  }

  const terminatedBy = getCurrentAdminEmail();

  try {
    const res = await fetch(`/api/contracts/customer/${currentCustomerId}/terminate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminatedBy, reason })
    });

    const data = await res.json();

    if (data.success) {
      alert('Avtal uppsagt!\n\nSista aktivitetsdag: ' + formatDate(data.effectiveDate));
      closeTerminationModal();
      await loadCustomerDetails(currentCustomerId);
    } else {
      alert('Fel: ' + data.message);
    }
  } catch (err) {
    console.error('Error terminating agreement:', err);
    alert('Ett fel uppstod vid uppsägning');
  }
}

// ===================================
// CONTRACT UPLOAD
// ===================================

function setupUploadButton() {
  document.getElementById('upload-new-contract').addEventListener('click', openUploadModal);
}

function openUploadModal() {
  document.getElementById('upload-modal').style.display = 'flex';
}

function closeUploadModal() {
  document.getElementById('upload-modal').style.display = 'none';
  document.getElementById('upload-form').reset();
}

async function submitUpload() {
  if (!currentCustomerId) return;

  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('contract-file');
  
  if (!fileInput.files[0]) {
    alert('Vänligen välj en fil');
    return;
  }

  const formData = new FormData();
  formData.append('contractFile', fileInput.files[0]);
  formData.append('customerId', currentCustomerId);
  formData.append('status', document.getElementById('contract-status').value);
  formData.append('packageType', document.getElementById('package-type').value);

  try {
    const res = await fetch('/api/contracts/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      alert('Avtal uppladdat!');
      closeUploadModal();
      await loadCustomerDetails(currentCustomerId);
    } else {
      alert('Fel: ' + data.message);
    }
  } catch (err) {
    console.error('Error uploading contract:', err);
    alert('Ett fel uppstod vid uppladdning');
  }
}

// ===================================
// CONTRACT OPERATIONS
// ===================================

async function downloadContractPDF(contractId) {
  try {
    window.open(`/api/contracts/${contractId}/pdf`, '_blank');
  } catch (err) {
    console.error('Error downloading PDF:', err);
    alert('Ett fel uppstod vid nedladdning');
  }
}

function openAddDocumentModal(contractId) {
  currentContractId = contractId;
  document.getElementById('add-document-modal').style.display = 'flex';
}

function closeAddDocumentModal() {
  document.getElementById('add-document-modal').style.display = 'none';
  document.getElementById('add-document-form').reset();
  currentContractId = null;
}

async function submitAddDocument() {
  if (!currentContractId) return;

  const fileInput = document.getElementById('additional-document');
  
  if (!fileInput.files[0]) {
    alert('Vänligen välj en fil');
    return;
  }

  const formData = new FormData();
  formData.append('document', fileInput.files[0]);

  try {
    const res = await fetch(`/api/contracts/${currentContractId}/add-document`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      alert('Dokument tillagt!');
      closeAddDocumentModal();
      await loadCustomerDetails(currentCustomerId);
    } else {
      alert('Fel: ' + data.message);
    }
  } catch (err) {
    console.error('Error adding document:', err);
    alert('Ett fel uppstod vid uppladdning');
  }
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

