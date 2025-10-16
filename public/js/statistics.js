// Statistics Page JavaScript

let currentDateRange = 30;
let charts = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadAllData();
  
  // Auto-refresh every 5 minutes
  setInterval(() => {
    refreshAllData();
  }, 5 * 60 * 1000);
});

function setupEventListeners() {
  const dateSelector = document.getElementById('dateRange');
  if (dateSelector) {
    dateSelector.addEventListener('change', (e) => {
      currentDateRange = parseInt(e.target.value);
      refreshAllData();
    });
  }
}

async function loadAllData() {
  showLoading(true);
  
  try {
    await Promise.all([
      loadOverviewKPIs(),
      loadAIPerformance(),
      loadFeatureUsage(),
      loadSupportQuality(),
      loadCustomerEngagement(),
      loadRevenueMetrics(),
      loadOnboardingFunnel()
    ]);
  } catch (error) {
    console.error('Error loading statistics:', error);
    alert('Ett fel uppstod vid laddning av statistik. Försök igen senare.');
  } finally {
    showLoading(false);
  }
}

async function refreshAllData() {
  await loadAllData();
}

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

// ==========================================
// KPI CARDS
// ==========================================

async function loadOverviewKPIs() {
  try {
    const response = await fetch(`/api/statistics/overview?dateRange=${currentDateRange}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to load overview data');
    }
    
    const data = result.data;
    
    // Update KPI cards
    document.getElementById('kpi-total-customers').textContent = formatNumber(data.totalCustomers);
    document.getElementById('kpi-mrr').textContent = formatCurrency(data.mrr);
    document.getElementById('kpi-arr').textContent = formatCurrency(data.arr);
    document.getElementById('kpi-online-users').textContent = formatNumber(data.onlineUsers);
    document.getElementById('kpi-ai-satisfaction').textContent = `${data.aiSatisfactionScore}%`;
    document.getElementById('kpi-open-tickets').textContent = formatNumber(data.openTickets);
    document.getElementById('kpi-avg-resolution').textContent = formatNumber(data.avgResolutionTime);
    
    // Growth indicator
    const growthElement = document.getElementById('kpi-customer-growth');
    if (growthElement) {
      const growthPercent = data.growthPercent || 0;
      const isPositive = growthPercent >= 0;
      growthElement.textContent = `${isPositive ? '+' : ''}${growthPercent}% vs förra månaden`;
      growthElement.className = `kpi-change ${isPositive ? 'positive' : 'negative'}`;
    }
  } catch (error) {
    console.error('Error loading overview KPIs:', error);
  }
}

// ==========================================
// CHARTS
// ==========================================

async function loadAIPerformance() {
  try {
    const response = await fetch(`/api/statistics/ai-performance?dateRange=${currentDateRange}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to load AI performance data');
    }
    
    const data = result.data;
    
    // Prepare data for chart
    const labels = data.dailyTrends.map(d => formatDate(d._id));
    const positiveData = data.dailyTrends.map(d => d.positive);
    const negativeData = data.dailyTrends.map(d => d.negative);
    const totalData = data.dailyTrends.map(d => d.total);
    
    // Create chart
    const ctx = document.getElementById('aiPerformanceChart');
    if (charts.aiPerformance) {
      charts.aiPerformance.destroy();
    }
    
    charts.aiPerformance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Positiv Feedback',
            data: positiveData,
            borderColor: '#2ecc71',
            backgroundColor: createGradient(ctx, '#2ecc71'),
            fill: true,
            tension: 0.4,
            borderWidth: 3
          },
          {
            label: 'Negativ Feedback',
            data: negativeData,
            borderColor: '#e74c3c',
            backgroundColor: createGradient(ctx, '#e74c3c'),
            fill: true,
            tension: 0.4,
            borderWidth: 3
          },
          {
            label: 'Totala Interaktioner',
            data: totalData,
            borderColor: '#3498db',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 }
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Feedback Antal'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Totala Interaktioner'
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        }
      }
    });
    
    // Update negative feedback table
    updateAIFeedbackTable(data.recentNegative);
  } catch (error) {
    console.error('Error loading AI performance:', error);
  }
}

async function loadFeatureUsage() {
  try {
    const response = await fetch(`/api/statistics/feature-usage?dateRange=${currentDateRange}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to load feature usage data');
    }
    
    const data = result.data;
    
    // Get top 10 features
    const topFeatures = data.featureStats.slice(0, 10);
    const labels = topFeatures.map(f => formatFeatureName(f._id));
    const counts = topFeatures.map(f => f.count);
    const colors = generateColorPalette(topFeatures.length);
    
    // Create chart
    const ctx = document.getElementById('featureUsageChart');
    if (charts.featureUsage) {
      charts.featureUsage.destroy();
    }
    
    charts.featureUsage = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Antal Användningar',
          data: counts,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12
          }
        },
        scales: {
          x: {
            beginAtZero: true
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        }
      }
    });
  } catch (error) {
    console.error('Error loading feature usage:', error);
  }
}

async function loadSupportQuality() {
  try {
    const response = await fetch(`/api/statistics/support-quality?dateRange=${currentDateRange}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to load support quality data');
    }
    
    const data = result.data;
    
    // Prepare data for volume chart
    const labels = data.dailyVolume.map(d => formatDate(d._id));
    const volumes = data.dailyVolume.map(d => d.count);
    
    // Create chart
    const ctx = document.getElementById('supportVolumeChart');
    if (charts.supportVolume) {
      charts.supportVolume.destroy();
    }
    
    charts.supportVolume = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Antal Ärenden',
          data: volumes,
          borderColor: '#9b59b6',
          backgroundColor: createGradient(ctx, '#9b59b6'),
          fill: true,
          tension: 0.4,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        }
      }
    });
    
    // Update tables
    updateSupportTeamTable(data.adminPerformance);
    updateTopIssuesTable(data.topIssues);
  } catch (error) {
    console.error('Error loading support quality:', error);
  }
}

async function loadCustomerEngagement() {
  try {
    const response = await fetch(`/api/statistics/customer-engagement?dateRange=${currentDateRange}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to load engagement data');
    }
    
    const data = result.data;
    
    // Prepare data for pie chart
    const distribution = data.healthDistribution || [];
    const healthCounts = {
      healthy: 0,
      at_risk: 0,
      churning: 0
    };
    
    distribution.forEach(item => {
      healthCounts[item._id] = item.count;
    });
    
    const labels = ['Friska', 'I Riskzon', 'Churn Risk'];
    const counts = [healthCounts.healthy, healthCounts.at_risk, healthCounts.churning];
    const colors = ['#2ecc71', '#f39c12', '#e74c3c'];
    
    // Create chart
    const ctx = document.getElementById('engagementChart');
    if (charts.engagement) {
      charts.engagement.destroy();
    }
    
    charts.engagement = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: {
                size: 13,
                weight: 'bold'
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        }
      }
    });
    
    // Update at-risk customers table
    updateAtRiskTable(data.atRiskCustomers);
  } catch (error) {
    console.error('Error loading customer engagement:', error);
  }
}

async function loadRevenueMetrics() {
  try {
    const response = await fetch(`/api/statistics/revenue-metrics?dateRange=${currentDateRange}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to load revenue data');
    }
    
    const data = result.data;
    
    // Package distribution pie chart
    const packageLabels = ['bas', 'grower', 'enterprise'];
    const packageCounts = [
      data.packageDistribution.bas || 0,
      data.packageDistribution.grower || 0,
      data.packageDistribution.enterprise || 0
    ];
    const packageColors = ['#3498db', '#2ecc71', '#9b59b6'];
    
    const ctx1 = document.getElementById('packageDistributionChart');
    if (charts.packageDistribution) {
      charts.packageDistribution.destroy();
    }
    
    charts.packageDistribution = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: packageLabels,
        datasets: [{
          data: packageCounts,
          backgroundColor: packageColors,
          borderColor: '#fff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: {
                size: 13,
                weight: 'bold'
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        }
      }
    });
    
    // Revenue trend chart (placeholder - would need historical data)
    const ctx2 = document.getElementById('revenueChart');
    if (charts.revenue) {
      charts.revenue.destroy();
    }
    
    // Generate dummy trend data for now
    const monthLabels = generateLastMonths(6);
    const revenueData = monthLabels.map(() => data.mrr + (Math.random() - 0.5) * data.mrr * 0.2);
    
    charts.revenue = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'MRR (SEK)',
          data: revenueData,
          borderColor: '#2ecc71',
          backgroundColor: createGradient(ctx2, '#2ecc71'),
          fill: true,
          tension: 0.4,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: function(context) {
                return `MRR: ${formatCurrency(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        }
      }
    });
  } catch (error) {
    console.error('Error loading revenue metrics:', error);
  }
}

async function loadOnboardingFunnel() {
  try {
    const response = await fetch(`/api/statistics/onboarding-funnel?dateRange=${currentDateRange}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to load onboarding data');
    }
    
    const data = result.data;
    const funnel = data.funnel;
    
    // Prepare funnel data
    const labels = ['Utkast', 'Inlämnad', 'Granskas', 'Godkänd', 'Avvisad', 'Slutförd'];
    const counts = [
      funnel.draft,
      funnel.submitted,
      funnel.in_review,
      funnel.approved,
      funnel.rejected,
      funnel.completed
    ];
    
    const colors = [
      'rgba(52, 152, 219, 0.7)',
      'rgba(155, 89, 182, 0.7)',
      'rgba(243, 156, 18, 0.7)',
      'rgba(46, 204, 113, 0.7)',
      'rgba(231, 76, 60, 0.7)',
      'rgba(26, 188, 156, 0.7)'
    ];
    
    // Create chart
    const ctx = document.getElementById('onboardingFunnelChart');
    if (charts.onboardingFunnel) {
      charts.onboardingFunnel.destroy();
    }
    
    charts.onboardingFunnel = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Antal',
          data: counts,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              afterLabel: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed.y / total) * 100).toFixed(1);
                return `${percentage}% av totalt`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        }
      }
    });
  } catch (error) {
    console.error('Error loading onboarding funnel:', error);
  }
}

// ==========================================
// TABLE UPDATES
// ==========================================

function updateAIFeedbackTable(data) {
  const tbody = document.querySelector('#aiFeedbackTable tbody');
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Ingen negativ feedback under denna period</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${formatDate(item.timestamp)}</td>
      <td>${item.customer?.name || 'Okänd'}</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${truncateText(item.question, 50)}</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${truncateText(item.aiResponse, 50)}</td>
      <td>${item.feedbackText || '-'}</td>
    </tr>
  `).join('');
}

function updateSupportTeamTable(data) {
  const tbody = document.querySelector('#supportTeamTable tbody');
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Ingen data tillgänglig</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(item => {
    const adminName = item.admin?.name || 'Okänd';
    const satisfaction = item.avgSatisfaction ? item.avgSatisfaction.toFixed(1) : 'N/A';
    const stars = item.avgSatisfaction ? renderStars(item.avgSatisfaction) : '-';
    
    return `
      <tr>
        <td><strong>${adminName}</strong></td>
        <td>${item.casesHandled}</td>
        <td>${item.avgFirstResponse ? Math.round(item.avgFirstResponse) : 'N/A'}</td>
        <td>${item.avgResolution ? Math.round(item.avgResolution) : 'N/A'}</td>
        <td>${stars} <span style="color: #95a5a6; font-size: 12px;">(${satisfaction})</span></td>
      </tr>
    `;
  }).join('');
}

function updateAtRiskTable(data) {
  const tbody = document.querySelector('#atRiskTable tbody');
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Inga kunder i riskzon</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.slice(0, 10).map(item => {
    const customer = item.customer || {};
    const statusBadge = item.healthStatus === 'churning' ? 
      '<span class="badge badge-danger">Churn Risk</span>' :
      '<span class="badge badge-warning">I Riskzon</span>';
    
    return `
      <tr>
        <td><strong>${customer.name || 'Okänd'}</strong></td>
        <td>${customer.package || 'N/A'}</td>
        <td><strong>${item.engagementScore || 0}</strong>/100</td>
        <td>${statusBadge}</td>
        <td>${formatDate(item.date)}</td>
      </tr>
    `;
  }).join('');
}

function updateTopIssuesTable(data) {
  const tbody = document.querySelector('#topIssuesTable tbody');
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="no-data">Ingen data tillgänglig</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(item => `
    <tr>
      <td><span class="badge badge-info">${item._id || 'Övrigt'}</span></td>
      <td><strong>${item.count}</strong></td>
      <td>${item.avgResolution ? Math.round(item.avgResolution) + ' min' : 'N/A'}</td>
      <td><span class="trend-indicator trend-neutral">→</span></td>
    </tr>
  `).join('');
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function createGradient(ctx, color) {
  const canvas = ctx.canvas;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, color.replace(')', ', 0.4)').replace('rgb', 'rgba'));
  gradient.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));
  return gradient;
}

function generateColorPalette(count) {
  const baseColors = [
    'rgba(52, 152, 219, 0.7)',
    'rgba(46, 204, 113, 0.7)',
    'rgba(155, 89, 182, 0.7)',
    'rgba(243, 156, 18, 0.7)',
    'rgba(231, 76, 60, 0.7)',
    'rgba(26, 188, 156, 0.7)',
    'rgba(230, 126, 34, 0.7)',
    'rgba(52, 73, 94, 0.7)',
    'rgba(149, 165, 166, 0.7)',
    'rgba(192, 57, 43, 0.7)'
  ];
  
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toLocaleString('sv-SE');
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 kr';
  return `${amount.toLocaleString('sv-SE')} kr`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

function formatFeatureName(feature) {
  const names = {
    'invoicing': 'Fakturering',
    'contracts': 'Avtal',
    'chat': 'Chatt',
    'marketing_google': 'Google Ads',
    'marketing_meta': 'Meta Ads',
    'marketing_tiktok': 'TikTok Ads',
    'marketing_linkedin': 'LinkedIn Ads',
    'analytics': 'Analytics',
    'inventory': 'Inventarier',
    'payments': 'Betalningar',
    'reports': 'Rapporter',
    'settings': 'Inställningar',
    'support': 'Support',
    'dashboard': 'Dashboard'
  };
  return names[feature] || feature;
}

function truncateText(text, maxLength) {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function renderStars(rating) {
  if (!rating) return '-';
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  
  let stars = '';
  for (let i = 0; i < fullStars; i++) {
    stars += '⭐';
  }
  if (halfStar) {
    stars += '½';
  }
  
  return `<span class="stars">${stars}</span>`;
}

function generateLastMonths(count) {
  const months = [];
  const date = new Date();
  
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    months.push(d.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' }));
  }
  
  return months;
}

