// services/engagementCalculator.js
const mongoose = require('mongoose');
const CustomerEngagementScore = require('../models/CustomerEngagementScore');
const FeatureUsageEvent = require('../models/FeatureUsageEvent');
const AIFeedback = require('../models/AIFeedback');
const Case = require('../models/Case');

// Customer connection for accessing customer portal data
const customerConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  dbName: "kundportal",
});

const CustomerPortal = customerConnection.model(
  "Customer",
  new mongoose.Schema({}, { strict: false }),
  "customers"
);

const LoginEvent = customerConnection.model(
  "LoginEvent",
  new mongoose.Schema({}, { strict: false }),
  "loginevents"
);

/**
 * Calculate engagement score for a single customer for a specific date
 */
async function calculateCustomerEngagement(customerId, date) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Count logins
    let loginCount = 0;
    try {
      loginCount = await LoginEvent.countDocuments({
        userId: customerId,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      });
    } catch (e) {
      console.log('LoginEvent not available for customer:', customerId);
    }

    // 2. Features used (unique features)
    const featureEvents = await FeatureUsageEvent.find({
      customerId,
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    const featuresUsed = [...new Set(featureEvents.map(e => e.feature))];
    const actionsPerformed = featureEvents.length;
    
    // Calculate total session time (sum of durations)
    const totalSessionTime = featureEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / 60; // minutes

    // 3. AI interactions
    const aiInteractions = await AIFeedback.countDocuments({
      customerId,
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    });

    // 4. Support tickets opened
    const supportTicketsOpened = await Case.countDocuments({
      customerId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // 5. Calculate engagement score
    // Formula: (loginCount * 10) + (uniqueFeaturesUsed * 15) + (sessionTimeMinutes / 10) + (aiPositiveFeedback * 5) - (supportTickets * 5)
    const aiPositiveFeedback = await AIFeedback.countDocuments({
      customerId,
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      rating: 'positive'
    });

    const engagementScore = Math.min(100, Math.max(0, 
      (loginCount * 10) +
      (featuresUsed.length * 15) +
      (totalSessionTime / 10) +
      (aiPositiveFeedback * 5) -
      (supportTicketsOpened * 5)
    ));

    // 6. Determine health status
    let healthStatus = 'healthy';
    if (engagementScore < 30) {
      healthStatus = 'churning';
    } else if (engagementScore < 70) {
      healthStatus = 'at_risk';
    }

    // 7. Create or update engagement score record
    const scoreData = {
      customerId,
      date: startOfDay,
      loginCount,
      featuresUsed,
      totalSessionTime: Math.round(totalSessionTime),
      actionsPerformed,
      aiInteractions,
      supportTicketsOpened,
      engagementScore: Math.round(engagementScore),
      healthStatus
    };

    await CustomerEngagementScore.findOneAndUpdate(
      { customerId, date: startOfDay },
      scoreData,
      { upsert: true, new: true }
    );

    return scoreData;
  } catch (err) {
    console.error(`❌ Error calculating engagement for customer ${customerId}:`, err);
    throw err;
  }
}

/**
 * Calculate engagement scores for all active customers for a specific date
 */
async function calculateDailyEngagement(date = null) {
  try {
    const targetDate = date || new Date();
    targetDate.setDate(targetDate.getDate() - 1); // Yesterday by default
    
    console.log(`📊 Starting daily engagement calculation for ${targetDate.toISOString().split('T')[0]}`);

    // Get all active customers
    const customers = await CustomerPortal.find({ 
      agreementStatus: 'active' 
    }).lean();

    console.log(`Found ${customers.length} active customers`);

    let successCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
      try {
        await calculateCustomerEngagement(customer._id, targetDate);
        successCount++;
        
        if (successCount % 10 === 0) {
          console.log(`Processed ${successCount}/${customers.length} customers...`);
        }
      } catch (err) {
        console.error(`Failed to calculate engagement for customer ${customer._id}:`, err.message);
        errorCount++;
      }
    }

    console.log(`✅ Daily engagement calculation complete: ${successCount} success, ${errorCount} errors`);
    
    return {
      success: true,
      date: targetDate,
      totalCustomers: customers.length,
      successCount,
      errorCount
    };
  } catch (err) {
    console.error('❌ Error in daily engagement calculation:', err);
    throw err;
  }
}

/**
 * Backfill engagement scores for a date range
 */
async function backfillEngagement(startDate, endDate) {
  try {
    console.log(`📊 Starting engagement backfill from ${startDate} to ${endDate}`);
    
    const customers = await CustomerPortal.find({ 
      agreementStatus: 'active' 
    }).lean();

    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      console.log(`Processing date: ${currentDate.toISOString().split('T')[0]}`);
      
      for (const customer of customers) {
        try {
          await calculateCustomerEngagement(customer._id, currentDate);
        } catch (err) {
          console.error(`Failed for customer ${customer._id} on ${currentDate}:`, err.message);
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('✅ Engagement backfill complete');
  } catch (err) {
    console.error('❌ Error in engagement backfill:', err);
    throw err;
  }
}

module.exports = {
  calculateCustomerEngagement,
  calculateDailyEngagement,
  backfillEngagement
};

