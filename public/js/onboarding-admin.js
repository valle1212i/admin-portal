// public/js/onboarding-admin.js
// Admin Dashboard for Managing Onboarding Applications

let currentPage = 1;
const itemsPerPage = 20;
let totalItems = 0;
let currentFilter = '';
let currentSearch = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadOnboardings();
  initializeEventListeners();
  loadStatistics();
});

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
  // Search
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value;
      currentPage = 1;
      loadOnboardings();
    }, 500);
  });
  
  // Status filter
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    currentPage = 1;
    loadOnboardings();
  });
}

/**
 * Load onboardings from API
 */
async function loadOnboardings() {
  try {
    const params = new URLSearchParams({
      limit: itemsPerPage,
      skip: (currentPage - 1) * itemsPerPage
    });
    
    if (currentFilter) {
      params.append('status', currentFilter);
    }
    
    if (currentSearch) {
      params.append('search', currentSearch);
    }
    
    const response = await fetch(`/api/onboarding?${params}`);
    const result = await response.json();
    
    if (result.success) {
      totalItems = result.total;
      renderOnboardings(result.data);
      renderPagination();
    } else {
      showToast('Kunde inte ladda onboardings', 'error');
    }
  } catch (error) {
    console.error('Error loading onboardings:', error);
    showToast('Kunde inte ladda onboardings', 'error');
  }
}

/**
 * Load statistics
 */
async function loadStatistics() {
  try {
    // Total
    const totalRes = await fetch('/api/onboarding?limit=0');
    const totalData = await totalRes.json();
    document.getElementById('statTotal').textContent = totalData.total || 0;
    
    // Submitted
    const submittedRes = await fetch('/api/onboarding?status=submitted&limit=0');
    const submittedData = await submittedRes.json();
    document.getElementById('statSubmitted').textContent = submittedData.total || 0;
    
    // Approved/Completed
    const approvedRes = await fetch('/api/onboarding?status=completed&limit=0');
    const approvedData = await approvedRes.json();
    document.getElementById('statApproved').textContent = approvedData.total || 0;
    
    // Draft
    const draftRes = await fetch('/api/onboarding?status=draft&limit=0');
    const draftData = await draftRes.json();
    document.getElementById('statDraft').textContent = draftData.total || 0;
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

/**
 * Render onboardings table
 */
function renderOnboardings(onboardings) {
  const tbody = document.getElementById('onboardingTableBody');
  
  if (onboardings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #6b7280;">
          Inga onboardings hittades
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = onboardings.map(onboarding => `
    <tr>
      <td>
        <strong>${onboarding.companyName || '-'}</strong><br>
        <small style="color: #6b7280;">${onboarding.email || ''}</small>
      </td>
      <td>${onboarding.organizationNumber || '-'}</td>
      <td>${onboarding.package || '-'}</td>
      <td>${renderStatusBadge(onboarding.onboardingStatus)}</td>
      <td>${formatDate(onboarding.onboardingSubmitted || onboarding.createdAt)}</td>
      <td>
        <div class="action-buttons">
          <a href="/onboarding-review.html?id=${onboarding._id}" class="btn-action btn-view">
            Granska
          </a>
          ${renderQuickActions(onboarding)}
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Render status badge
 */
function renderStatusBadge(status) {
  const statusLabels = {
    draft: 'Utkast',
    submitted: 'Inskickad',
    in_review: 'Granskas',
    approved: 'Godkänd',
    completed: 'Slutförd',
    rejected: 'Avvisad'
  };
  
  return `<span class="status-badge ${status}">${statusLabels[status] || status}</span>`;
}

/**
 * Render quick action buttons
 */
function renderQuickActions(onboarding) {
  if (onboarding.onboardingStatus === 'submitted') {
    return `
      <button class="btn-action btn-approve" onclick="quickApprove('${onboarding._id}')">
        Godkänn
      </button>
      <button class="btn-action btn-reject" onclick="quickReject('${onboarding._id}')">
        Avvisa
      </button>
    `;
  }
  return '';
}

/**
 * Quick approve
 */
async function quickApprove(id) {
  if (!confirm('Är du säker på att du vill godkänna denna ansökan? Detta kommer att skapa ett kundkonto.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/onboarding/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvedBy: 'Admin',
        notes: 'Snabbgodkänd från admin-panel'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Onboarding godkänd och kund skapad!', 'success');
      loadOnboardings();
      loadStatistics();
    } else {
      showToast('Kunde inte godkänna: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error approving:', error);
    showToast('Kunde inte godkänna onboarding', 'error');
  }
}

/**
 * Quick reject
 */
async function quickReject(id) {
  const reason = prompt('Ange orsak för avvisning:');
  if (!reason) return;
  
  try {
    const response = await fetch(`/api/onboarding/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rejectedBy: 'Admin',
        reason
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Onboarding avvisad', 'success');
      loadOnboardings();
      loadStatistics();
    } else {
      showToast('Kunde inte avvisa: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error rejecting:', error);
    showToast('Kunde inte avvisa onboarding', 'error');
  }
}

/**
 * Render pagination
 */
function renderPagination() {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const pagination = document.getElementById('pagination');
  
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  
  let html = '';
  
  // Previous button
  html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">← Föregående</button>`;
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<button disabled>...</button>`;
    }
  }
  
  // Next button
  html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Nästa →</button>`;
  
  pagination.innerHTML = html;
}

/**
 * Change page
 */
function changePage(page) {
  currentPage = page;
  loadOnboardings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
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

