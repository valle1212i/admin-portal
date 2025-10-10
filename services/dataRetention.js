/**
 * Data Retention Service
 * 
 * This service handles automated data retention and cleanup for terminated customer accounts.
 * - Checks for customers approaching their data retention deadline (30 days warning)
 * - Sends email notifications to authorized admins
 * - Provides manual confirmation before actual deletion
 */

const Customer = require('../models/Customer');
const Contract = require('../models/Contract');

// Authorized admins who can confirm deletions
const AUTHORIZED_ADMINS = [
  'korpela.valentin@gmail.com',
  'vincent.korpela@gmail.com',
  'andre.soderberg@outlook.com'
];

/**
 * Check for customers approaching data retention deadline
 * Send warnings 30 days before deletion
 */
async function checkDataRetentionDeadlines() {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find customers approaching data retention deadline
    const customersToWarn = await Customer.find({
      dataRetentionUntil: {
        $gte: now,
        $lte: thirtyDaysFromNow
      },
      agreementStatus: { $in: ['terminated', 'read_only'] }
    }).select('name email dataRetentionUntil terminationDate terminationReason');

    if (customersToWarn.length > 0) {
      console.log(`⚠️  ${customersToWarn.length} kunder närmar sig borttagningstid`);
      
      // Send email notification to admins
      await sendDataRetentionWarning(customersToWarn);
    }

    return {
      success: true,
      count: customersToWarn.length,
      customers: customersToWarn
    };
  } catch (err) {
    console.error('Fel vid kontroll av dataretention:', err);
    throw err;
  }
}

/**
 * Get list of customers ready for deletion (past retention date)
 */
async function getCustomersReadyForDeletion() {
  try {
    const now = new Date();

    const customers = await Customer.find({
      dataRetentionUntil: { $lt: now },
      agreementStatus: { $in: ['terminated', 'read_only'] }
    }).select('name email dataRetentionUntil terminationDate terminationReason');

    return {
      success: true,
      count: customers.length,
      customers
    };
  } catch (err) {
    console.error('Fel vid hämtning av kunder för borttagning:', err);
    throw err;
  }
}

/**
 * Archive customer data before deletion
 * This creates a backup in a separate collection
 */
async function archiveCustomerData(customerId) {
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Kund hittades inte');
    }

    // Get all associated data
    const contracts = await Contract.find({ customerId });

    // Create archive object
    const archive = {
      customerId: customer._id,
      customerData: customer.toObject(),
      contracts: contracts.map(c => c.toObject()),
      archivedAt: new Date(),
      archivedReason: 'Data retention period expired'
    };

    // TODO: Save to archive collection or external backup
    // For now, just log the archive creation
    console.log(`📦 Arkiverat data för kund ${customer.name} (${customer.email})`);

    // In production, you would save to an archive collection:
    // const ArchivedCustomer = require('../models/ArchivedCustomer');
    // await ArchivedCustomer.create(archive);

    return archive;
  } catch (err) {
    console.error('Fel vid arkivering av kunddata:', err);
    throw err;
  }
}

/**
 * Delete customer data after archiving
 * Requires manual admin confirmation
 */
async function deleteCustomerData(customerId, confirmedBy) {
  try {
    // Check authorization
    if (!AUTHORIZED_ADMINS.includes(confirmedBy)) {
      throw new Error('Obehörig: Endast auktoriserade admins kan bekräfta borttagning');
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Kund hittades inte');
    }

    // Check if data retention period has expired
    if (customer.dataRetentionUntil && customer.dataRetentionUntil > new Date()) {
      throw new Error('Dataretentionsperioden har inte gått ut än');
    }

    // Archive data first
    await archiveCustomerData(customerId);

    // Mark customer as deleted (safer than actual deletion)
    customer.agreementStatus = 'deleted';
    customer.deletedAt = new Date();
    customer.deletedBy = confirmedBy;
    await customer.save();

    console.log(`🗑️  Kund ${customer.name} (${customer.email}) markerad som borttagen av ${confirmedBy}`);

    return {
      success: true,
      message: 'Kunddata arkiverad och markerad för borttagning',
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        deletedAt: customer.deletedAt
      }
    };
  } catch (err) {
    console.error('Fel vid borttagning av kunddata:', err);
    throw err;
  }
}

/**
 * Send email notification to admins about upcoming data deletions
 * TODO: Implement actual email sending
 */
async function sendDataRetentionWarning(customers) {
  try {
    const emailContent = `
      <h2>Påminnelse: Kunders dataretention går ut</h2>
      <p>Följande kunder närmar sig sin borttagningstid (30 dagar kvar):</p>
      <ul>
        ${customers.map(c => `
          <li>
            <strong>${c.name}</strong> (${c.email})<br>
            Borttagningstid: ${c.dataRetentionUntil.toLocaleDateString('sv-SE')}<br>
            Uppsagd: ${c.terminationDate.toLocaleDateString('sv-SE')}<br>
            Anledning: ${c.terminationReason || 'Ej angiven'}
          </li>
        `).join('')}
      </ul>
      <p>Vänligen granska och bekräfta borttagning via admin-portalen.</p>
    `;

    // TODO: Implement actual email sending
    console.log('📧 Email notification skulle skickas till:', AUTHORIZED_ADMINS);
    console.log('📧 Innehåll:', emailContent);

    // In production, use an email service:
    // const emailService = require('./emailService');
    // await emailService.sendToAdmins(AUTHORIZED_ADMINS, 'Data Retention Warning', emailContent);

    return {
      success: true,
      message: 'Email-varning skickad till administratörer'
    };
  } catch (err) {
    console.error('Fel vid skickning av email-varning:', err);
    throw err;
  }
}

/**
 * Cron job function to run daily
 * Checks for customers approaching retention deadline
 */
async function runDailyDataRetentionCheck() {
  try {
    console.log('🕐 Kör daglig dataretention-kontroll...');
    
    const result = await checkDataRetentionDeadlines();
    
    if (result.count > 0) {
      console.log(`⚠️  Hittade ${result.count} kunder som närmar sig borttagningstid`);
    } else {
      console.log('✅ Inga kunder närmar sig borttagningstid');
    }
    
    return result;
  } catch (err) {
    console.error('❌ Fel vid daglig dataretention-kontroll:', err);
    throw err;
  }
}

module.exports = {
  checkDataRetentionDeadlines,
  getCustomersReadyForDeletion,
  archiveCustomerData,
  deleteCustomerData,
  sendDataRetentionWarning,
  runDailyDataRetentionCheck,
  AUTHORIZED_ADMINS
};

