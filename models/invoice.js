const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  // Customer Information
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  
  // Invoice Details
  invoiceNumber: { 
    type: String, 
    required: true, 
    unique: true,
    // Format: INV-2025-0001
  },
  
  // Line Items
  items: [{
    description: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true }, // in SEK
    amount: { type: Number, required: true } // quantity * unitPrice
  }],
  
  // Financial Details
  subtotal: { type: Number, required: true },
  taxRate: { type: Number, default: 25 }, // 25% Swedish VAT
  taxAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'SEK' },
  
  // Payment Information
  status: {
    type: String,
    enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['manual', 'stripe', 'direct_debit', 'bank_transfer'],
    default: 'manual'
  },
  
  // Stripe Integration
  stripeInvoiceId: { type: String, sparse: true },
  stripeCustomerId: { type: String },
  stripePaymentIntentId: { type: String },
  stripeSubscriptionId: { type: String }, // for recurring
  
  // Direct Debit
  directDebit: {
    enabled: { type: Boolean, default: false },
    mandateId: { type: String },
    setupAt: { type: Date }
  },
  
  // Dates
  invoiceDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true },
  paidDate: { type: Date },
  
  // History & Modifications
  originalDueDate: { type: Date }, // for tracking postponements
  postponementHistory: [{
    oldDate: Date,
    newDate: Date,
    reason: String,
    postponedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    postponedAt: { type: Date, default: Date.now }
  }],
  
  priceChangeHistory: [{
    oldAmount: Number,
    newAmount: Number,
    reason: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    changedAt: { type: Date, default: Date.now }
  }],
  
  // PDF
  pdfUrl: { type: String },
  pdfGeneratedAt: { type: Date },
  
  // Notes
  notes: { type: String },
  internalNotes: { type: String },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
invoiceSchema.index({ customerId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ customerEmail: 1 });

// Auto-update timestamp
invoiceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set original due date on first save
  if (this.isNew && !this.originalDueDate) {
    this.originalDueDate = this.dueDate;
  }
  
  // Auto-update overdue status
  if (this.status === 'pending' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }
  
  next();
});

// Helper method to generate next invoice number
invoiceSchema.statics.generateInvoiceNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = process.env.INVOICE_NUMBER_PREFIX || 'INV';
  
  // Find the latest invoice for this year
  const latestInvoice = await this.findOne({
    invoiceNumber: new RegExp(`^${prefix}-${year}-`)
  }).sort({ invoiceNumber: -1 });
  
  let nextNumber = 1;
  if (latestInvoice) {
    const match = latestInvoice.invoiceNumber.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }
  
  // Format: INV-2025-0001
  return `${prefix}-${year}-${nextNumber.toString().padStart(4, '0')}`;
};

// Helper method to calculate totals
invoiceSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
  this.taxAmount = Math.round(this.subtotal * (this.taxRate / 100));
  this.totalAmount = this.subtotal + this.taxAmount;
};

module.exports = mongoose.model('Invoice', invoiceSchema);

