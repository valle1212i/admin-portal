// services/supportAnalyzer.js
const SupportQualityMetric = require('../models/SupportQualityMetric');
const Case = require('../models/Case');

/**
 * Calculate support metrics for a specific case
 */
async function analyzeCaseMetrics(caseId) {
  try {
    const caseDoc = await Case.findById(caseId).lean();
    
    if (!caseDoc) {
      throw new Error(`Case ${caseId} not found`);
    }

    // Calculate first response time
    let firstResponseTime = null;
    const adminMessages = caseDoc.messages.filter(m => m.sender === 'admin');
    
    if (adminMessages.length > 0) {
      const firstAdminMessage = adminMessages[0];
      const caseCreatedAt = new Date(caseDoc.createdAt);
      const firstResponseAt = new Date(firstAdminMessage.timestamp);
      
      // Calculate in minutes
      firstResponseTime = Math.round((firstResponseAt - caseCreatedAt) / (1000 * 60));
    }

    // Calculate resolution time (if case is closed)
    let resolutionTime = null;
    if (caseDoc.status === 'closed' && caseDoc.updatedAt) {
      const caseCreatedAt = new Date(caseDoc.createdAt);
      const closedAt = new Date(caseDoc.updatedAt);
      
      // Calculate in minutes
      resolutionTime = Math.round((closedAt - caseCreatedAt) / (1000 * 60));
    }

    // Count admin switches
    let numberOfAdminSwitches = 0;
    let lastAdmin = null;
    
    for (const message of caseDoc.messages) {
      if (message.sender === 'admin') {
        const currentAdmin = caseDoc.assignedAdmin?.toString();
        if (lastAdmin && lastAdmin !== currentAdmin) {
          numberOfAdminSwitches++;
        }
        lastAdmin = currentAdmin;
      }
    }

    // Determine if escalated (based on number of admin switches or internal notes)
    const wasEscalated = numberOfAdminSwitches > 1 || (caseDoc.internalNotes?.length || 0) > 3;

    // Auto-categorize based on case topic and description
    const tags = categorizeCaseIssue(caseDoc.topic, caseDoc.description);

    // Create or update support quality metric
    const metricData = {
      caseId,
      customerId: caseDoc.customerId,
      assignedAdminId: caseDoc.assignedAdmin,
      firstResponseTime,
      resolutionTime,
      numberOfMessages: caseDoc.messages.length,
      numberOfAdminSwitches,
      wasEscalated,
      tags,
      timestamp: new Date(caseDoc.createdAt),
      createdAt: new Date(caseDoc.createdAt),
      closedAt: caseDoc.status === 'closed' ? new Date(caseDoc.updatedAt) : null
    };

    const metric = await SupportQualityMetric.findOneAndUpdate(
      { caseId },
      metricData,
      { upsert: true, new: true }
    );

    return metric;
  } catch (err) {
    console.error(`❌ Error analyzing case ${caseId}:`, err);
    throw err;
  }
}

/**
 * Categorize case issue based on topic and description
 */
function categorizeCaseIssue(topic, description) {
  const tags = [];
  const text = `${topic} ${description}`.toLowerCase();

  // Define keywords for different categories
  const categories = {
    'billing': ['faktura', 'betalning', 'billing', 'payment', 'invoice', 'kostnad', 'pris'],
    'technical': ['fungerar inte', 'error', 'bug', 'teknisk', 'technical', 'problem', 'fel'],
    'account': ['konto', 'inloggning', 'login', 'account', 'lösenord', 'password'],
    'feature_request': ['önskar', 'förslag', 'feature', 'request', 'want', 'add'],
    'integration': ['integration', 'api', 'sync', 'connect', 'koppling'],
    'onboarding': ['onboarding', 'setup', 'start', 'ny', 'new', 'first time'],
    'marketing': ['marknadsföring', 'marketing', 'ads', 'annons', 'kampanj'],
    'reporting': ['rapport', 'report', 'analytics', 'statistik', 'data']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      tags.push(category);
    }
  }

  // Default tag if no category matched
  if (tags.length === 0) {
    tags.push('general');
  }

  return tags;
}

/**
 * Analyze all cases and update metrics (daily job)
 */
async function analyzeDailySupportMetrics(date = null) {
  try {
    const targetDate = date || new Date();
    targetDate.setDate(targetDate.getDate() - 1); // Yesterday by default
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`📊 Starting support quality analysis for ${targetDate.toISOString().split('T')[0]}`);

    // Get all cases created or updated on target date
    const cases = await Case.find({
      $or: [
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
        { updatedAt: { $gte: startOfDay, $lte: endOfDay } }
      ]
    }).lean();

    console.log(`Found ${cases.length} cases to analyze`);

    let successCount = 0;
    let errorCount = 0;

    for (const caseDoc of cases) {
      try {
        await analyzeCaseMetrics(caseDoc._id);
        successCount++;
        
        if (successCount % 10 === 0) {
          console.log(`Processed ${successCount}/${cases.length} cases...`);
        }
      } catch (err) {
        console.error(`Failed to analyze case ${caseDoc._id}:`, err.message);
        errorCount++;
      }
    }

    console.log(`✅ Support quality analysis complete: ${successCount} success, ${errorCount} errors`);
    
    // Calculate aggregated metrics for the day
    const metrics = await SupportQualityMetric.aggregate([
      {
        $match: {
          timestamp: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          avgFirstResponse: { $avg: '$firstResponseTime' },
          avgResolution: { $avg: '$resolutionTime' },
          avgSatisfaction: { $avg: '$customerSatisfactionRating' },
          escalatedCount: {
            $sum: { $cond: ['$wasEscalated', 1, 0] }
          }
        }
      }
    ]);

    const summary = metrics[0] || {};
    
    console.log('📈 Daily Summary:', {
      date: targetDate.toISOString().split('T')[0],
      totalCases: summary.totalCases || 0,
      avgFirstResponse: Math.round(summary.avgFirstResponse || 0),
      avgResolution: Math.round(summary.avgResolution || 0),
      avgSatisfaction: summary.avgSatisfaction ? summary.avgSatisfaction.toFixed(2) : 'N/A',
      escalatedCount: summary.escalatedCount || 0
    });

    return {
      success: true,
      date: targetDate,
      casesAnalyzed: cases.length,
      successCount,
      errorCount,
      summary
    };
  } catch (err) {
    console.error('❌ Error in daily support analysis:', err);
    throw err;
  }
}

/**
 * Get trending support issues for a date range
 */
async function getTrendingIssues(daysAgo = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const trends = await SupportQualityMetric.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
          avgResolutionTime: { $avg: '$resolutionTime' },
          avgSatisfaction: { $avg: '$customerSatisfactionRating' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return trends;
  } catch (err) {
    console.error('❌ Error getting trending issues:', err);
    throw err;
  }
}

/**
 * Get admin performance metrics for a date range
 */
async function getAdminPerformance(daysAgo = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const performance = await SupportQualityMetric.aggregate([
      { 
        $match: { 
          timestamp: { $gte: startDate },
          assignedAdminId: { $ne: null }
        } 
      },
      {
        $group: {
          _id: '$assignedAdminId',
          casesHandled: { $sum: 1 },
          avgFirstResponse: { $avg: '$firstResponseTime' },
          avgResolution: { $avg: '$resolutionTime' },
          avgSatisfaction: { $avg: '$customerSatisfactionRating' },
          escalatedCases: {
            $sum: { $cond: ['$wasEscalated', 1, 0] }
          }
        }
      },
      { $sort: { casesHandled: -1 } }
    ]);

    return performance;
  } catch (err) {
    console.error('❌ Error getting admin performance:', err);
    throw err;
  }
}

module.exports = {
  analyzeCaseMetrics,
  analyzeDailySupportMetrics,
  getTrendingIssues,
  getAdminPerformance,
  categorizeCaseIssue
};

