const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const AIFeedback = require('../models/AIFeedback');
const FeatureUsageEvent = require('../models/FeatureUsageEvent');
const SupportQualityMetric = require('../models/SupportQualityMetric');
const CustomerEngagementScore = require('../models/CustomerEngagementScore');
const Customer = require('../models/Customer');
const Case = require('../models/Case');
const Invoice = require('../models/invoice');
const Onboarding = require('../models/Onboarding');

// Customer connection for accessing customer portal data
const customerConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  dbName: "kundportal",
});

const CustomerPortal = customerConnection.model(
  "Customer",
  new mongoose.Schema({}, { strict: false }),
  "customers"
);

// ==========================================
// DATA COLLECTION ENDPOINTS (from Customer Portal)
// ==========================================

// POST /api/statistics/ai-feedback - Collect AI feedback
router.post('/ai-feedback', async (req, res) => {
  try {
    const {
      customerId,
      question,
      aiResponse,
      rating,
      category,
      feedbackText,
      conversationId,
      responseTime,
      escalatedToHuman,
      resolved
    } = req.body;

    if (!customerId || !question || !aiResponse || !rating) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const feedback = new AIFeedback({
      customerId,
      question,
      aiResponse,
      rating,
      category: category || 'helpfulness',
      feedbackText,
      conversationId,
      responseTime: responseTime || 0,
      escalatedToHuman: escalatedToHuman || false,
      resolved: resolved || false,
      timestamp: new Date()
    });

    await feedback.save();

    res.json({ 
      success: true, 
      message: 'Feedback saved successfully',
      feedbackId: feedback._id
    });
  } catch (err) {
    console.error('❌ Error saving AI feedback:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving feedback' 
    });
  }
});

// POST /api/statistics/feature-usage - Track feature usage (batched)
router.post('/feature-usage', async (req, res) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Events array is required' 
      });
    }

    // Validate and prepare events
    const validEvents = events.filter(event => 
      event.customerId && event.feature && event.action
    ).map(event => ({
      customerId: event.customerId,
      userId: event.userId,
      feature: event.feature,
      action: event.action,
      metadata: event.metadata || {},
      sessionId: event.sessionId,
      duration: event.duration || 0,
      deviceType: event.deviceType || 'unknown',
      browserInfo: event.browserInfo,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date()
    }));

    if (validEvents.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid events to save' 
      });
    }

    await FeatureUsageEvent.insertMany(validEvents);

    res.json({ 
      success: true, 
      message: `${validEvents.length} events saved successfully`,
      saved: validEvents.length
    });
  } catch (err) {
    console.error('❌ Error saving feature usage events:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving events' 
    });
  }
});

// POST /api/statistics/support-rating - Customer rates support
router.post('/support-rating', async (req, res) => {
  try {
    const {
      caseId,
      customerId,
      rating,
      feedback
    } = req.body;

    if (!caseId || !customerId || !rating) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Find or create support quality metric
    let metric = await SupportQualityMetric.findOne({ caseId });
    
    if (!metric) {
      // Get case details
      const caseDoc = await Case.findById(caseId);
      if (!caseDoc) {
        return res.status(404).json({ 
          success: false, 
          message: 'Case not found' 
        });
      }

      metric = new SupportQualityMetric({
        caseId,
        customerId,
        assignedAdminId: caseDoc.assignedAdmin,
        numberOfMessages: caseDoc.messages.length
      });
    }

    metric.customerSatisfactionRating = rating;
    metric.customerFeedback = feedback || '';
    
    await metric.save();

    res.json({ 
      success: true, 
      message: 'Rating saved successfully' 
    });
  } catch (err) {
    console.error('❌ Error saving support rating:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving rating' 
    });
  }
});

// POST /api/statistics/session-heartbeat - Track session activity
router.post('/session-heartbeat', async (req, res) => {
  try {
    const { customerId, sessionId, duration } = req.body;

    if (!customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'customerId is required' 
      });
    }

    // This can be used to update engagement scores in real-time
    // For now, just acknowledge receipt
    res.json({ 
      success: true, 
      message: 'Heartbeat received' 
    });
  } catch (err) {
    console.error('❌ Error processing session heartbeat:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing heartbeat' 
    });
  }
});

// ==========================================
// ANALYTICS ENDPOINTS (for Admin Dashboard)
// ==========================================

// GET /api/statistics/overview - Top-level KPIs
router.get('/overview', async (req, res) => {
  try {
    const { dateRange = '30' } = req.query;
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Total customers
    const totalCustomers = await CustomerPortal.countDocuments();

    // Active customers (active agreement)
    const activeCustomers = await CustomerPortal.countDocuments({ 
      agreementStatus: 'active' 
    });

    // Calculate MRR
    const packagePrices = { Bas: 499, Grower: 999, Enterprise: 1999 };
    const customers = await CustomerPortal.find({ agreementStatus: 'active' });
    const mrr = customers.reduce((sum, c) => sum + (packagePrices[c.package] || 0), 0);

    // Active users today (from LoginEvent or last 15 min)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const LoginEvent = customerConnection.model(
      "LoginEvent",
      new mongoose.Schema({}, { strict: false }),
      "loginevents"
    );
    
    let onlineUsers = 0;
    try {
      const recentLogins = await LoginEvent.aggregate([
        { $match: { timestamp: { $gte: fifteenMinutesAgo } } },
        { $group: { _id: "$userId" } },
        { $count: "uniqueUsers" }
      ]);
      onlineUsers = recentLogins.length > 0 ? recentLogins[0].uniqueUsers : 0;
    } catch (e) {
      console.log('LoginEvent not available');
    }

    // AI Satisfaction Score
    const aiStats = await AIFeedback.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { 
        $group: {
          _id: null,
          total: { $sum: 1 },
          positive: {
            $sum: { $cond: [{ $eq: ['$rating', 'positive'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const aiSatisfactionScore = aiStats.length > 0 
      ? Math.round((aiStats[0].positive / aiStats[0].total) * 100)
      : 0;

    // Open support tickets
    const openTickets = await Case.countDocuments({ 
      status: { $in: ['new', 'in_progress', 'waiting'] } 
    });

    // Average support resolution time
    const supportMetrics = await SupportQualityMetric.aggregate([
      { 
        $match: { 
          resolutionTime: { $ne: null },
          timestamp: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' }
        }
      }
    ]);

    const avgResolutionTime = supportMetrics.length > 0 
      ? Math.round(supportMetrics[0].avgResolutionTime)
      : 0;

    // Customer growth (vs last month)
    const lastMonthStart = new Date();
    lastMonthStart.setDate(lastMonthStart.getDate() - 60);
    const lastMonthEnd = new Date();
    lastMonthEnd.setDate(lastMonthEnd.getDate() - 30);
    
    const lastMonthCustomers = await CustomerPortal.countDocuments({
      createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd }
    });
    
    const thisMonthCustomers = await CustomerPortal.countDocuments({
      createdAt: { $gte: lastMonthEnd }
    });

    const growthPercent = lastMonthCustomers > 0
      ? Math.round(((thisMonthCustomers - lastMonthCustomers) / lastMonthCustomers) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalCustomers,
        activeCustomers,
        mrr,
        arr: mrr * 12,
        onlineUsers,
        aiSatisfactionScore,
        openTickets,
        avgResolutionTime,
        growthPercent
      }
    });
  } catch (err) {
    console.error('❌ Error fetching overview stats:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching statistics' 
    });
  }
});

// GET /api/statistics/ai-performance - AI metrics & trends
router.get('/ai-performance', async (req, res) => {
  try {
    const { dateRange = '30' } = req.query;
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Daily trends
    const dailyTrends = await AIFeedback.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          total: { $sum: 1 },
          positive: {
            $sum: { $cond: [{ $eq: ['$rating', 'positive'] }, 1, 0] }
          },
          negative: {
            $sum: { $cond: [{ $eq: ['$rating', 'negative'] }, 1, 0] }
          },
          avgResponseTime: { $avg: '$responseTime' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Overall stats
    const overallStats = await AIFeedback.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          positive: {
            $sum: { $cond: [{ $eq: ['$rating', 'positive'] }, 1, 0] }
          },
          negative: {
            $sum: { $cond: [{ $eq: ['$rating', 'negative'] }, 1, 0] }
          },
          avgResponseTime: { $avg: '$responseTime' },
          escalated: { $sum: { $cond: ['$escalatedToHuman', 1, 0] } },
          resolved: { $sum: { $cond: ['$resolved', 1, 0] } }
        }
      }
    ]);

    // Recent negative feedback
    const recentNegative = await AIFeedback.find({ 
      rating: 'negative',
      timestamp: { $gte: startDate }
    })
    .populate('customerId', 'name email')
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

    // Trending questions (most common)
    const trendingQuestions = await AIFeedback.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$question',
          count: { $sum: 1 },
          positiveRate: {
            $avg: { $cond: [{ $eq: ['$rating', 'positive'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        dailyTrends,
        overallStats: overallStats[0] || {},
        recentNegative,
        trendingQuestions
      }
    });
  } catch (err) {
    console.error('❌ Error fetching AI performance:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching AI performance data' 
    });
  }
});

// GET /api/statistics/feature-usage - Feature usage analytics
router.get('/feature-usage', async (req, res) => {
  try {
    const { dateRange = '30' } = req.query;
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Feature usage by feature type
    const featureStats = await FeatureUsageEvent.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$feature',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$customerId' },
          actions: { $push: '$action' }
        }
      },
      {
        $project: {
          _id: 1,
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Daily feature usage trends
    const dailyTrends = await FeatureUsageEvent.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            feature: '$feature'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Feature adoption by package
    const packageAdoption = await FeatureUsageEvent.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $group: {
          _id: {
            feature: '$feature',
            package: '$customer.package'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        featureStats,
        dailyTrends,
        packageAdoption
      }
    });
  } catch (err) {
    console.error('❌ Error fetching feature usage:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching feature usage data' 
    });
  }
});

// GET /api/statistics/support-quality - Support team performance
router.get('/support-quality', async (req, res) => {
  try {
    const { dateRange = '30' } = req.query;
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Overall support metrics
    const overallMetrics = await SupportQualityMetric.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          avgFirstResponse: { $avg: '$firstResponseTime' },
          avgResolution: { $avg: '$resolutionTime' },
          avgSatisfaction: { $avg: '$customerSatisfactionRating' },
          totalCases: { $sum: 1 },
          escalated: { $sum: { $cond: ['$wasEscalated', 1, 0] } },
          reopened: { $sum: { $cond: ['$reopened', 1, 0] } }
        }
      }
    ]);

    // Admin performance
    const adminPerformance = await SupportQualityMetric.aggregate([
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
          avgSatisfaction: { $avg: '$customerSatisfactionRating' }
        }
      },
      {
        $lookup: {
          from: 'admins',
          localField: '_id',
          foreignField: '_id',
          as: 'admin'
        }
      },
      { $unwind: { path: '$admin', preserveNullAndEmptyArrays: true } },
      { $sort: { casesHandled: -1 } }
    ]);

    // Daily ticket volume
    const dailyVolume = await SupportQualityMetric.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top issues (by tags)
    const topIssues = await SupportQualityMetric.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $unwind: { path: '$tags', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
          avgResolution: { $avg: '$resolutionTime' }
        }
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        overallMetrics: overallMetrics[0] || {},
        adminPerformance,
        dailyVolume,
        topIssues
      }
    });
  } catch (err) {
    console.error('❌ Error fetching support quality:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching support quality data' 
    });
  }
});

// GET /api/statistics/customer-engagement - Engagement & churn data
router.get('/customer-engagement', async (req, res) => {
  try {
    const { dateRange = '30' } = req.query;
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Get latest engagement scores for each customer
    const latestScores = await CustomerEngagementScore.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$customerId',
          latestScore: { $first: '$engagementScore' },
          healthStatus: { $first: '$healthStatus' },
          date: { $first: '$date' }
        }
      }
    ]);

    // Distribution by health status
    const healthDistribution = await CustomerEngagementScore.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: { customerId: '$customerId', healthStatus: '$healthStatus' },
          latestDate: { $first: '$date' }
        }
      },
      {
        $group: {
          _id: '$_id.healthStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Customers at risk (health score trend declining)
    const atRiskCustomers = await CustomerEngagementScore.find({
      healthStatus: { $in: ['at_risk', 'churning'] },
      date: { $gte: startDate }
    })
    .sort({ date: -1 })
    .limit(20)
    .populate('customerId', 'name email package')
    .lean();

    // Engagement trends over time
    const engagementTrends = await CustomerEngagementScore.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          avgScore: { $avg: '$engagementScore' },
          avgLogins: { $avg: '$loginCount' },
          avgSessionTime: { $avg: '$totalSessionTime' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        latestScores,
        healthDistribution,
        atRiskCustomers,
        engagementTrends
      }
    });
  } catch (err) {
    console.error('❌ Error fetching customer engagement:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching engagement data' 
    });
  }
});

// GET /api/statistics/revenue-metrics - MRR, ARR, ARPU, etc.
router.get('/revenue-metrics', async (req, res) => {
  try {
    const packagePrices = { Bas: 499, Grower: 999, Enterprise: 1999 };

    // Get all active customers with their packages
    const activeCustomers = await CustomerPortal.find({ 
      agreementStatus: 'active' 
    }).lean();

    // Calculate MRR
    const mrr = activeCustomers.reduce((sum, c) => 
      sum + (packagePrices[c.package] || 0), 0
    );

    // Calculate ARR
    const arr = mrr * 12;

    // Calculate ARPU
    const arpu = activeCustomers.length > 0 
      ? Math.round(mrr / activeCustomers.length) 
      : 0;

    // Package distribution
    const packageDistribution = {
      Bas: activeCustomers.filter(c => c.package === 'Bas').length,
      Grower: activeCustomers.filter(c => c.package === 'Grower').length,
      Enterprise: activeCustomers.filter(c => c.package === 'Enterprise').length
    };

    // Churn MRR (terminated this month)
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const churnedCustomers = await CustomerPortal.find({
      agreementStatus: 'terminated',
      terminationDate: { $gte: thisMonthStart }
    }).lean();

    const churnMRR = churnedCustomers.reduce((sum, c) => 
      sum + (packagePrices[c.package] || 0), 0
    );

    // Expansion MRR (package upgrades this month)
    // This would require tracking package change history
    // For now, we'll calculate based on package change requests
    const expansionMRR = 0; // TODO: Implement when package change history is available

    // Revenue by package
    const revenueByPackage = {
      Bas: packageDistribution.Bas * packagePrices.Bas,
      Grower: packageDistribution.Grower * packagePrices.Grower,
      Enterprise: packageDistribution.Enterprise * packagePrices.Enterprise
    };

    // MRR trend (last 12 months)
    // This would require historical MRR snapshots
    // For now, return current values
    const mrrTrend = [];

    // Invoice metrics
    const thisYear = new Date().getFullYear();
    const invoiceStats = await Invoice.aggregate([
      { 
        $match: { 
          invoiceDate: { 
            $gte: new Date(`${thisYear}-01-01`),
            $lte: new Date()
          } 
        } 
      },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          paidInvoices: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          paidRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$totalAmount', 0] }
          },
          overdueInvoices: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          },
          overdueAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$totalAmount', 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        mrr,
        arr,
        arpu,
        packageDistribution,
        churnMRR,
        expansionMRR,
        revenueByPackage,
        mrrTrend,
        invoiceStats: invoiceStats[0] || {}
      }
    });
  } catch (err) {
    console.error('❌ Error fetching revenue metrics:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching revenue metrics' 
    });
  }
});

// GET /api/statistics/onboarding-funnel - Onboarding conversion metrics
router.get('/onboarding-funnel', async (req, res) => {
  try {
    // Count by status
    const funnelStats = await Onboarding.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to object for easier access
    const statusCounts = funnelStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Calculate conversion rates
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const submitted = (statusCounts.submitted || 0) + (statusCounts.in_review || 0) + 
                     (statusCounts.approved || 0) + (statusCounts.completed || 0);
    const approved = (statusCounts.approved || 0) + (statusCounts.completed || 0);
    const completed = statusCounts.completed || 0;

    const submissionRate = total > 0 ? Math.round((submitted / total) * 100) : 0;
    const approvalRate = submitted > 0 ? Math.round((approved / submitted) * 100) : 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Average time to complete
    const completedOnboardings = await Onboarding.find({ 
      status: 'completed',
      submittedAt: { $exists: true }
    }).lean();

    const avgCompletionTime = completedOnboardings.length > 0
      ? completedOnboardings.reduce((sum, ob) => {
          const timeToComplete = ob.submittedAt 
            ? (new Date(ob.submittedAt) - new Date(ob.createdAt)) / (1000 * 60 * 60 * 24)
            : 0;
          return sum + timeToComplete;
        }, 0) / completedOnboardings.length
      : 0;

    // Rejection reasons
    const rejectionReasons = await Onboarding.aggregate([
      { $match: { status: 'rejected' } },
      {
        $group: {
          _id: '$rejectionReason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        funnel: {
          draft: statusCounts.draft || 0,
          submitted: statusCounts.submitted || 0,
          in_review: statusCounts.in_review || 0,
          approved: statusCounts.approved || 0,
          rejected: statusCounts.rejected || 0,
          completed: statusCounts.completed || 0
        },
        conversionRates: {
          submissionRate,
          approvalRate,
          completionRate
        },
        avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
        rejectionReasons
      }
    });
  } catch (err) {
    console.error('❌ Error fetching onboarding funnel:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching onboarding data' 
    });
  }
});

module.exports = router;

