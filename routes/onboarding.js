const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const Onboarding = require("../models/Onboarding");
const Customer = require("../models/Customer");
const emailService = require("../services/emailService");
const externalIntegrations = require("../services/externalIntegrations");

// Middleware to require admin login
function requireAdmin(req, res, next) {
  if (!req.session?.admin) {
    return res.status(401).json({ success: false, message: "Inte inloggad" });
  }
  next();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'onboarding');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const onboardingId = req.params.id || 'temp';
    const documentType = req.body.documentType || 'document';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${onboardingId}-${documentType}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|png|jpg|jpeg/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(ext);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Endast PDF, PNG, JPG och JPEG-filer tillåtna'));
  }
});

// Package pricing configuration
const PACKAGE_PRICING = {
  'bas': {
    monthly: 499,
    quarterly: 1347, // 10% discount
    annually: 4790, // 20% discount
    maxUsers: 2,
    setupFee: 0
  },
  'grower': {
    monthly: 999,
    quarterly: 2697, // 10% discount
    annually: 9590, // 20% discount
    maxUsers: 5,
    setupFee: 0
  },
  'enterprise': {
    monthly: 1999,
    quarterly: 5397, // 10% discount
    annually: 19190, // 20% discount
    maxUsers: 20,
    setupFee: 0
  }
};

const ADDITIONAL_SERVICES_PRICING = {
  email_integration: 199,
  ai_chatbot: 299,
  advanced_analytics: 399,
  inventory_management: 499,
  marketing_automation: 599
};

/**
 * Calculate price based on package, billing frequency, and add-ons
 */
function calculatePrice(packageName, billingFrequency, additionalServices = []) {
  const packagePricing = PACKAGE_PRICING[packageName];
  if (!packagePricing) {
    return { error: 'Ogiltigt paket' };
  }
  
  let basePrice = packagePricing[billingFrequency] || packagePricing.monthly;
  let monthlyBase = packagePricing.monthly;
  
  // Calculate add-ons
  let addOnsPrice = 0;
  additionalServices.forEach(service => {
    addOnsPrice += ADDITIONAL_SERVICES_PRICING[service] || 0;
  });
  
  // Adjust add-ons for billing frequency
  let totalAddOns = addOnsPrice;
  if (billingFrequency === 'quarterly') {
    totalAddOns = addOnsPrice * 3 * 0.9; // 10% discount
  } else if (billingFrequency === 'annually') {
    totalAddOns = addOnsPrice * 12 * 0.8; // 20% discount
  }
  
  const total = basePrice + totalAddOns;
  const monthlyEquivalent = monthlyBase + addOnsPrice;
  
  return {
    basePrice,
    addOnsPrice: totalAddOns,
    totalPrice: total,
    monthlyEquivalent,
    setupFee: packagePricing.setupFee,
    maxUsers: packagePricing.maxUsers,
    billingFrequency,
    discount: billingFrequency === 'quarterly' ? 10 : billingFrequency === 'annually' ? 20 : 0
  };
}

/**
 * POST /api/onboarding/draft
 * Create or update a draft onboarding
 */
router.post("/draft", async (req, res) => {
  try {
    const { onboardingId, step, data } = req.body;
    
    let onboarding;
    
    if (onboardingId) {
      // Update existing draft
      onboarding = await Onboarding.findById(onboardingId);
      if (!onboarding) {
        return res.status(404).json({ success: false, message: "Onboarding inte hittad" });
      }
      
      // Update fields from data
      Object.assign(onboarding, data);
      onboarding.currentStep = step;
      
      if (!onboarding.completedSteps.includes(step)) {
        onboarding.completedSteps.push(step);
      }
      
      await onboarding.save();
    } else {
      // Create new draft
      onboarding = new Onboarding({
        ...data,
        currentStep: step || 1,
        completedSteps: [step || 1],
        onboardingStatus: 'draft'
      });
      
      await onboarding.save();
      
      // Send welcome email (async, don't wait)
      emailService.sendWelcomeEmail(onboarding).catch(err => 
        console.error('Failed to send welcome email:', err)
      );
    }
    
    res.json({
      success: true,
      onboardingId: onboarding._id,
      currentStep: onboarding.currentStep,
      savedData: onboarding
    });
  } catch (error) {
    console.error("Error saving draft:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/onboarding/:id/autosave
 * Auto-save draft (called every 30s from frontend)
 */
router.patch("/:id/autosave", async (req, res) => {
  try {
    const { step, data } = req.body;
    
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding inte hittad" });
    }
    
    Object.assign(onboarding, data);
    onboarding.currentStep = step;
    
    await onboarding.save();
    
    res.json({ success: true, message: "Auto-sparad" });
  } catch (error) {
    console.error("Error auto-saving:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/onboarding/:id
 * Get onboarding by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding inte hittad" });
    }
    
    res.json({ success: true, data: onboarding });
  } catch (error) {
    console.error("Error fetching onboarding:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/onboarding
 * List all onboardings (admin only)
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, limit = 20, skip = 0, search } = req.query;
    
    const query = {};
    if (status) {
      query.onboardingStatus = status;
    }
    
    if (search) {
      query.$or = [
        { companyName: new RegExp(search, 'i') },
        { organizationNumber: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }
    
    const total = await Onboarding.countDocuments(query);
    const onboardings = await Onboarding.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();
    
    res.json({
      success: true,
      data: onboardings,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error("Error listing onboardings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/:id/submit
 * Submit onboarding for review
 */
router.post("/:id/submit", async (req, res) => {
  try {
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding inte hittad" });
    }
    
    // Validate required fields
    if (!onboarding.organizationNumber || !onboarding.companyName || !onboarding.package) {
      return res.status(400).json({ 
        success: false, 
        message: "Fyll i alla obligatoriska fält innan du skickar in" 
      });
    }
    
    onboarding.onboardingStatus = 'submitted';
    onboarding.onboardingSubmitted = new Date();
    
    await onboarding.save();
    
    // Send confirmation email
    emailService.sendSubmissionConfirmation(onboarding).catch(err =>
      console.error('Failed to send submission confirmation:', err)
    );
    
    // Notify admins
    emailService.notifyAdminNewSubmission(onboarding).catch(err =>
      console.error('Failed to notify admin:', err)
    );
    
    res.json({
      success: true,
      message: "Ansökan inskickad",
      estimatedActivation: "1-2 arbetsdagar"
    });
  } catch (error) {
    console.error("Error submitting onboarding:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/:id/approve
 * Approve onboarding and create customer account (admin only)
 */
router.post("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { approvedBy, notes } = req.body;
    
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding inte hittad" });
    }
    
    if (onboarding.onboardingStatus === 'approved' || onboarding.onboardingStatus === 'completed') {
      return res.status(400).json({ success: false, message: "Redan godkänd" });
    }
    
    // Calculate pricing
    const pricing = calculatePrice(
      onboarding.package,
      onboarding.billingFrequency,
      onboarding.additionalServices
    );
    
    // Create customer account in customer portal
    const customer = new Customer({
      email: onboarding.email,
      companyName: onboarding.companyName,
      organizationNumber: onboarding.organizationNumber,
      package: onboarding.package,
      maxUsers: pricing.maxUsers,
      currentUserCount: 1,
      agreementStatus: 'active',
      billingCycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      // Add other relevant fields
      phone: onboarding.phone,
      industry: onboarding.industry,
      website: onboarding.website
    });
    
    await customer.save();
    
    // Generate temporary password for customer portal
    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase();
    
    // TODO: Create user account in customer portal with tempPassword
    // This would typically involve calling a customer portal API or creating a User document
    
    // Update onboarding record
    onboarding.onboardingStatus = 'completed';
    onboarding.onboardingApproved = new Date();
    onboarding.onboardingCompleted = new Date();
    onboarding.customerId = customer._id;
    onboarding.customerCreated = true;
    onboarding.adminNotes = notes;
    onboarding.assignedTo = approvedBy || req.session.admin.email;
    onboarding.monthlyPrice = pricing.monthlyEquivalent;
    onboarding.setupFee = pricing.setupFee;
    onboarding.firstInvoiceDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    await onboarding.save();
    
    // Send approval email with credentials
    emailService.sendApprovalEmail(onboarding, {
      email: onboarding.email,
      password: tempPassword
    }).catch(err => console.error('Failed to send approval email:', err));
    
    // TODO: Create first invoice
    // TODO: Create contract record
    
    res.json({
      success: true,
      message: "Onboarding godkänd och kund skapad",
      customerId: customer._id,
      credentials: {
        email: onboarding.email,
        temporaryPassword: tempPassword
      }
    });
  } catch (error) {
    console.error("Error approving onboarding:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/:id/reject
 * Reject onboarding (admin only)
 */
router.post("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { rejectedBy, reason } = req.body;
    
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding inte hittad" });
    }
    
    onboarding.onboardingStatus = 'rejected';
    onboarding.adminNotes = reason;
    onboarding.assignedTo = rejectedBy || req.session.admin.email;
    
    await onboarding.save();
    
    // Send rejection email
    emailService.sendRejectionEmail(onboarding, reason, rejectedBy).catch(err =>
      console.error('Failed to send rejection email:', err)
    );
    
    res.json({
      success: true,
      message: "Onboarding avvisad"
    });
  } catch (error) {
    console.error("Error rejecting onboarding:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/:id/request-info
 * Request additional information (admin only)
 */
router.post("/:id/request-info", requireAdmin, async (req, res) => {
  try {
    const { message, requestedBy } = req.body;
    
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding inte hittad" });
    }
    
    onboarding.onboardingStatus = 'in_review';
    
    await onboarding.save();
    
    // Send info request email
    emailService.sendInfoRequest(onboarding, message, requestedBy).catch(err =>
      console.error('Failed to send info request email:', err)
    );
    
    res.json({
      success: true,
      message: "Förfrågan skickad"
    });
  } catch (error) {
    console.error("Error requesting info:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/:id/upload-document
 * Upload verification document
 */
router.post("/:id/upload-document", upload.single('file'), async (req, res) => {
  try {
    const { documentType } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Ingen fil uppladdad" });
    }
    
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding inte hittad" });
    }
    
    // Add document to array
    onboarding.verificationDocuments.push({
      type: documentType,
      filename: req.file.filename,
      fileUrl: `/uploads/onboarding/${req.file.filename}`,
      uploadedAt: new Date(),
      verified: false
    });
    
    await onboarding.save();
    
    res.json({
      success: true,
      message: "Dokument uppladdat",
      document: {
        type: documentType,
        filename: req.file.filename,
        fileUrl: `/uploads/onboarding/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/onboarding/calculate-price
 * Calculate pricing based on package and options
 */
router.post("/calculate-price", async (req, res) => {
  try {
    const { package: packageName, billingFrequency, additionalServices } = req.body;
    
    const pricing = calculatePrice(packageName, billingFrequency, additionalServices);
    
    if (pricing.error) {
      return res.status(400).json({ success: false, message: pricing.error });
    }
    
    res.json({ success: true, pricing });
  } catch (error) {
    console.error("Error calculating price:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/onboarding/validate/orgnr/:number
 * Validate and lookup organization number (stubbed)
 */
router.get("/validate/orgnr/:number", async (req, res) => {
  try {
    const orgNumber = req.params.number;
    
    // Validate format
    const validation = externalIntegrations.validateSwedishOrgNumber(orgNumber);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }
    
    // Lookup company data (stubbed)
    const lookupResult = await externalIntegrations.lookupOrgNumber(orgNumber);
    
    res.json({
      success: true,
      valid: true,
      data: lookupResult.data
    });
  } catch (error) {
    console.error("Error validating org number:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/onboarding/validate/vat/:number
 * Validate VAT number (stubbed)
 */
router.get("/validate/vat/:number", async (req, res) => {
  try {
    const { countryCode = 'SE' } = req.query;
    const vatNumber = req.params.number;
    
    const result = await externalIntegrations.validateVAT(vatNumber, countryCode);
    
    res.json({
      success: true,
      valid: result.valid,
      data: result
    });
  } catch (error) {
    console.error("Error validating VAT:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

