const mongoose = require("mongoose");

const OnboardingSchema = new mongoose.Schema({
  // Step 1: Company Information
  organizationNumber: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  legalEntityType: { 
    type: String, 
    enum: ['AB', 'Aktiebolag', 'Enskild firma', 'Handelsbolag', 'Kommanditbolag', 'Ekonomisk förening', 'Stiftelse'],
    required: true 
  },
  registrationDate: Date,
  website: String,
  
  // Contact Information
  businessAddress: {
    street: String,
    postalCode: String,
    city: String,
    country: { type: String, default: 'Sverige' }
  },
  billingAddress: {
    street: String,
    postalCode: String,
    city: String,
    country: String,
    sameAsBusiness: { type: Boolean, default: true }
  },
  phone: String,
  email: { type: String, required: true },
  
  // Step 2: Business Classification
  mccCode: { 
    type: String, 
    required: true,
    // Common MCC codes for Swedish businesses
    enum: [
      '5734', // Computer Software Stores
      '7372', // Computer Programming/Data Processing
      '5045', // Computers/Electronics
      '7311', // Advertising Services
      '8999', // Professional Services
      '5399', // Misc. General Merchandise
      '7379', // Computer Maintenance and Repair
      '5999', // Miscellaneous and Specialty Retail Stores
      'other'
    ]
  },
  mccCodeCustom: String, // If 'other' selected
  sniCode: String, // Swedish Standard Industrial Classification
  industry: {
    type: String,
    enum: ['E-commerce', 'SaaS', 'Consulting', 'Retail', 'Manufacturing', 'Services', 'Technology', 'Marketing', 'Other']
  },
  businessDescription: { type: String, required: true, maxlength: 500 },
  annualRevenue: {
    type: String,
    enum: ['0-500k', '500k-2M', '2M-10M', '10M+']
  },
  employeeCount: Number,
  
  // Step 3: Primary Contact Person
  primaryContact: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    personalNumber: String, // Optional, for BankID verification
    role: String,
    linkedin: String
  },
  
  // Step 4: Payment & Banking Information
  bankDetails: {
    bankName: String,
    accountNumber: String,
    clearingNumber: String,
    iban: String,
    bic: String,
    accountHolder: String
  },
  preferredPaymentMethods: [String], // ['Swish', 'Bankgiro', 'Plusgiro', 'Credit Card', 'Invoice']
  billingCurrency: { type: String, default: 'SEK', enum: ['SEK', 'EUR', 'USD'] },
  paymentTerms: { 
    type: String, 
    default: '30', 
    enum: ['10', '15', '30', '60'] 
  },
  
  // Step 5: Package Selection
  package: {
    type: String,
    enum: ['bas', 'grower', 'enterprise'],
    required: true,
    default: 'bas'
  },
  billingFrequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'annually'],
    default: 'monthly'
  },
  additionalServices: [{
    type: String,
    enum: ['email_integration', 'ai_chatbot', 'advanced_analytics', 'inventory_management', 'marketing_automation']
  }],
  
  // Step 6: User Accounts Setup
  initialUsers: [{
    name: String,
    email: String,
    role: { type: String, enum: ['Admin', 'User', 'Viewer'], default: 'User' },
    phone: String
  }],
  
  // Step 7: Integration Preferences
  integrations: {
    accountingSoftware: {
      type: String,
      enum: ['Fortnox', 'Visma', 'Bokio', 'PE Accounting', 'Other', 'None']
    },
    crmSystem: {
      type: String,
      enum: ['HubSpot', 'Salesforce', 'Pipedrive', 'Other', 'None']
    },
    ecommercePlatform: {
      type: String,
      enum: ['Shopify', 'WooCommerce', 'Magento', 'Custom', 'None']
    },
    marketingTools: [String] // ['Google Ads', 'Meta Ads', 'TikTok Ads', 'LinkedIn Ads']
  },
  
  // Step 8: Legal & Compliance
  legal: {
    termsAccepted: { type: Boolean, required: true },
    termsAcceptedDate: Date,
    privacyPolicyAccepted: { type: Boolean, required: true },
    gdprConsent: { type: Boolean, required: true },
    gdprConsentDate: Date,
    dataProcessingAgreement: Boolean,
    vatRegistered: Boolean,
    vatNumber: String,
    fSkatt: Boolean,
    reverseVat: Boolean
  },
  
  // Step 9: Business Verification
  verificationDocuments: [{
    type: { 
      type: String, 
      enum: ['registration_certificate', 'id_document', 'bank_certificate', 'f_skatt_certificate']
    },
    filename: String,
    fileUrl: String,
    uploadedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
  }],
  verificationMethod: {
    type: String,
    enum: ['bankid', 'email', 'manual'],
    default: 'email'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_review', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNotes: String,
  
  // Step 10: Status & Metadata
  onboardingStatus: {
    type: String,
    enum: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'completed'],
    default: 'draft'
  },
  currentStep: { type: Number, default: 1, min: 1, max: 10 },
  completedSteps: [Number],
  
  // Timestamps
  onboardingStarted: { type: Date, default: Date.now },
  onboardingSubmitted: Date,
  onboardingApproved: Date,
  onboardingCompleted: Date,
  
  // Admin Notes
  adminNotes: String,
  assignedTo: String, // Admin email handling this onboarding
  
  // Linked Customer Account
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerCreated: Boolean,
  
  // Pricing Calculation
  monthlyPrice: Number,
  setupFee: Number,
  firstInvoiceDate: Date,
  
  createdBy: String,
  updatedBy: String
}, { timestamps: true });

// Index for faster queries
OnboardingSchema.index({ organizationNumber: 1 });
OnboardingSchema.index({ onboardingStatus: 1 });
OnboardingSchema.index({ 'primaryContact.email': 1 });

const Onboarding = mongoose.model("Onboarding", OnboardingSchema, "onboardings");

module.exports = Onboarding;

