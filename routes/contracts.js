const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Contract = require('../models/Contract');
const Customer = require('../models/Customer');

// Authorized admins for package approval
const AUTHORIZED_ADMINS = [
  'korpela.valentin@gmail.com',
  'vincent.korpela@gmail.com',
  'andre.soderberg@outlook.com'
];

// 📂 Lagring av avtal
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'public', 'contracts');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// 📥 Ladda upp nytt avtal
router.post('/upload', upload.single('contractFile'), async (req, res) => {
  try {
    const { customerId, status } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "Ingen fil uppladdad" });

    const fileUrl = '/contracts/' + req.file.filename;

    const newContract = await Contract.create({
      customerId,
      filename: req.file.originalname,
      fileUrl,
      status
    });

    res.json({ success: true, contract: newContract });
  } catch (err) {
    console.error("❌ Fel vid uppladdning av avtal:", err);
    res.status(500).json({ success: false, message: "Serverfel vid uppladdning" });
  }
});

// 📤 Hämta alla avtal
router.get('/', async (req, res) => {
  try {
    const contracts = await Contract.find().populate('customerId', 'name email').sort({ uploadedAt: -1 });

    const formatted = contracts.map(c => ({
      _id: c._id,
      customerName: c.customerId?.name || "Okänd",
      filename: c.filename,
      status: c.status,
      uploadedAt: c.uploadedAt,
      fileUrl: c.fileUrl
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Fel vid hämtning av avtal:", err);
    res.status(500).json({ success: false, message: "Kunde inte hämta avtal" });
  }
});

// 📤 Hämta alla avtal för en specifik kund
router.get('/:customerId', async (req, res) => {
    try {
      const { customerId } = req.params;
      const contracts = await Contract.find({ customerId })
        .sort({ uploadedAt: -1 });
  
      res.json({
        success: true,
        contracts: contracts.map(c => ({
          _id: c._id,
          filename: c.filename,
          status: c.status,
          uploadedAt: c.uploadedAt,
          fileUrl: c.fileUrl
        }))
      });
    } catch (err) {
      console.error("Fel vid hämtning av kundens avtal:", err);
      res.status(500).json({ success: false, message: "Kunde inte hämta kundens avtal" });
    }
  });

// 🔍 Search customers by name/email
router.get('/search/customers', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, customers: [] });
    }

    const searchRegex = new RegExp(q, 'i');
    const customers = await Customer.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex }
      ]
    }).limit(20).select('name email package agreementStatus maxUsers currentUserCount');

    res.json({ success: true, customers });
  } catch (err) {
    console.error("Fel vid sökning av kunder:", err);
    res.status(500).json({ success: false, message: "Kunde inte söka kunder" });
  }
});

// 📋 Get customer agreement details
router.get('/customer/:customerId/details', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Kund hittades inte" });
    }

    const contracts = await Contract.find({ customerId }).sort({ uploadedAt: -1 });

    res.json({
      success: true,
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        package: customer.package || 'Bas',
        maxUsers: customer.maxUsers || 2,
        currentUserCount: customer.currentUserCount || 1,
        agreementStatus: customer.agreementStatus || 'active',
        terminationDate: customer.terminationDate,
        terminationEffectiveDate: customer.terminationEffectiveDate,
        terminationReason: customer.terminationReason,
        billingCycleEnd: customer.billingCycleEnd,
        packageChangeRequests: customer.packageChangeRequests || []
      },
      contracts: contracts.map(c => ({
        _id: c._id,
        filename: c.filename,
        fileUrl: c.fileUrl,
        status: c.status,
        uploadedAt: c.uploadedAt,
        packageType: c.packageType,
        additionalDocuments: c.additionalDocuments || [],
        terminatedAt: c.terminatedAt,
        terminatedBy: c.terminatedBy
      }))
    });
  } catch (err) {
    console.error("Fel vid hämtning av kunddetaljer:", err);
    res.status(500).json({ success: false, message: "Kunde inte hämta kunddetaljer" });
  }
});

// 📦 Change customer package (creates request for approval)
router.post('/customer/:customerId/change-package', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { newPackage, effectiveDate, requestedBy } = req.body;

    if (!['Bas', 'Grower', 'Enterprise'].includes(newPackage)) {
      return res.status(400).json({ success: false, message: "Ogiltigt paket" });
    }

    if (!['immediate', 'next_billing'].includes(effectiveDate)) {
      return res.status(400).json({ success: false, message: "Ogiltigt datum" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Kund hittades inte" });
    }

    // Create package change request
    if (!customer.packageChangeRequests) {
      customer.packageChangeRequests = [];
    }

    customer.packageChangeRequests.push({
      requestedPackage: newPackage,
      requestedBy,
      requestedAt: new Date(),
      status: 'pending',
      effectiveDate
    });

    await customer.save();

    res.json({ 
      success: true, 
      message: "Paketändring begärd och väntar på godkännande",
      request: customer.packageChangeRequests[customer.packageChangeRequests.length - 1]
    });
  } catch (err) {
    console.error("Fel vid begäran om paketändring:", err);
    res.status(500).json({ success: false, message: "Kunde inte begära paketändring" });
  }
});

// ✅ Approve package change
router.post('/package-change/:customerId/:requestId/approve', async (req, res) => {
  try {
    const { customerId, requestId } = req.params;
    const { approvedBy } = req.body;

    if (!AUTHORIZED_ADMINS.includes(approvedBy)) {
      return res.status(403).json({ 
        success: false, 
        message: "Du har inte behörighet att godkänna paketändringar" 
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Kund hittades inte" });
    }

    const request = customer.packageChangeRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Begäran hittades inte" });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: "Begäran har redan behandlats" });
    }

    // Approve the request
    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();

    // Update package based on effective date
    if (request.effectiveDate === 'immediate') {
      customer.package = request.requestedPackage;
      // Update max users based on package
      if (request.requestedPackage === 'Bas') customer.maxUsers = 2;
      else if (request.requestedPackage === 'Grower') customer.maxUsers = 5;
      else if (request.requestedPackage === 'Enterprise') customer.maxUsers = 10;
    }

    await customer.save();

    // TODO: Sync with customer portal
    // await syncWithCustomerPortal(customerId, customer.package, customer.maxUsers);

    res.json({ 
      success: true, 
      message: "Paketändring godkänd",
      newPackage: request.effectiveDate === 'immediate' ? customer.package : request.requestedPackage
    });
  } catch (err) {
    console.error("Fel vid godkännande av paketändring:", err);
    res.status(500).json({ success: false, message: "Kunde inte godkänna paketändring" });
  }
});

// ❌ Reject package change
router.post('/package-change/:customerId/:requestId/reject', async (req, res) => {
  try {
    const { customerId, requestId } = req.params;
    const { rejectedBy, reason } = req.body;

    if (!AUTHORIZED_ADMINS.includes(rejectedBy)) {
      return res.status(403).json({ 
        success: false, 
        message: "Du har inte behörighet att avslå paketändringar" 
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Kund hittades inte" });
    }

    const request = customer.packageChangeRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Begäran hittades inte" });
    }

    request.status = 'rejected';
    request.approvedBy = rejectedBy; // Using same field for rejectedBy
    request.approvedAt = new Date();

    await customer.save();

    res.json({ success: true, message: "Paketändring avslagen" });
  } catch (err) {
    console.error("Fel vid avslag av paketändring:", err);
    res.status(500).json({ success: false, message: "Kunde inte avslå paketändring" });
  }
});

// 🛑 Terminate agreement
router.post('/customer/:customerId/terminate', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { terminatedBy, reason } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Kund hittades inte" });
    }

    // Calculate end of current month
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Set termination details
    customer.terminationDate = now;
    customer.terminationEffectiveDate = endOfMonth;
    customer.terminationReason = reason;
    customer.dataRetentionUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()); // 12 months from now

    await customer.save();

    // Mark contracts as terminated
    await Contract.updateMany(
      { customerId },
      { 
        terminatedAt: now,
        terminatedBy,
        status: 'Utgått'
      }
    );

    // Stop future invoices after effectiveDate
    try {
      const invoicesRoute = require('./invoices');
      if (invoicesRoute.stopFutureInvoices) {
        await invoicesRoute.stopFutureInvoices(customerId, endOfMonth);
      }
    } catch (invoiceErr) {
      console.error("Warning: Could not stop future invoices:", invoiceErr);
      // Continue even if invoice stopping fails
    }

    res.json({ 
      success: true, 
      message: "Avtal uppsagt",
      terminationDate: now,
      effectiveDate: endOfMonth,
      dataRetentionUntil: customer.dataRetentionUntil
    });
  } catch (err) {
    console.error("Fel vid uppsägning av avtal:", err);
    res.status(500).json({ success: false, message: "Kunde inte säga upp avtal" });
  }
});

// 📄 Download contract as PDF (placeholder - actual PDF generation would need additional library)
router.get('/:contractId/pdf', async (req, res) => {
  try {
    const { contractId } = req.params;
    const contract = await Contract.findById(contractId);
    
    if (!contract) {
      return res.status(404).json({ success: false, message: "Avtal hittades inte" });
    }

    // For now, redirect to the original file
    // In production, you would generate a proper PDF here
    const filePath = path.join(__dirname, '..', 'public', contract.fileUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Fil hittades inte" });
    }

    res.download(filePath, contract.filename);
  } catch (err) {
    console.error("Fel vid nedladdning av PDF:", err);
    res.status(500).json({ success: false, message: "Kunde inte ladda ner PDF" });
  }
});

// 📎 Upload additional document
router.post('/:contractId/add-document', upload.single('document'), async (req, res) => {
  try {
    const { contractId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Ingen fil uppladdad" });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Avtal hittades inte" });
    }

    const fileUrl = '/contracts/' + req.file.filename;
    
    if (!contract.additionalDocuments) {
      contract.additionalDocuments = [];
    }

    contract.additionalDocuments.push({
      name: req.file.originalname,
      fileUrl,
      uploadedAt: new Date()
    });

    await contract.save();

    res.json({ 
      success: true, 
      message: "Dokument tillagt",
      document: contract.additionalDocuments[contract.additionalDocuments.length - 1]
    });
  } catch (err) {
    console.error("Fel vid uppladdning av dokument:", err);
    res.status(500).json({ success: false, message: "Kunde inte ladda upp dokument" });
  }
});

// 🗑️ Data retention cleanup (would be called by cron job)
router.post('/cleanup-expired', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find customers approaching data retention deadline
    const customersToWarn = await Customer.find({
      dataRetentionUntil: {
        $gte: now,
        $lte: thirtyDaysFromNow
      },
      agreementStatus: { $ne: 'active' }
    });

    // TODO: Send email notifications to admins

    res.json({
      success: true,
      message: `${customersToWarn.length} kunder närmar sig borttagningstid`,
      customers: customersToWarn.map(c => ({
        _id: c._id,
        name: c.name,
        email: c.email,
        dataRetentionUntil: c.dataRetentionUntil
      }))
    });
  } catch (err) {
    console.error("Fel vid kontroll av utgången data:", err);
    res.status(500).json({ success: false, message: "Kunde inte kontrollera utgången data" });
  }
});

// 🗑️ Confirm deletion (requires manual admin confirmation)
router.post('/confirm-deletion/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { confirmedBy } = req.body;

    if (!AUTHORIZED_ADMINS.includes(confirmedBy)) {
      return res.status(403).json({ 
        success: false, 
        message: "Du har inte behörighet att bekräfta borttagning" 
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Kund hittades inte" });
    }

    // Archive customer data before deletion
    // TODO: Implement proper archiving to separate collection or backup

    // For now, just mark as deleted (safer approach)
    customer.agreementStatus = 'deleted';
    await customer.save();

    res.json({ 
      success: true, 
      message: "Kunddata arkiverad och markerad för borttagning"
    });
  } catch (err) {
    console.error("Fel vid bekräftelse av borttagning:", err);
    res.status(500).json({ success: false, message: "Kunde inte bekräfta borttagning" });
  }
});

module.exports = router;
