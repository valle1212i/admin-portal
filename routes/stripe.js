const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const Customer = require('../models/Customer');
const requireAdminLogin = require('../middleware/requireAdminLogin');

// Initialize Stripe (will be configured with environment variable)
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized');
  } else {
    console.log('⚠️ STRIPE_SECRET_KEY not found, Stripe integration disabled');
  }
} catch (err) {
  console.error('❌ Error initializing Stripe:', err);
}

// Middleware to check Stripe is available
const checkStripe = (req, res, next) => {
  if (!stripe) {
    return res.status(503).json({ 
      success: false, 
      message: 'Stripe integration not configured' 
    });
  }
  next();
};

// 🔗 POST /api/stripe/create-customer - Create Stripe customer
router.post('/create-customer', requireAdminLogin, checkStripe, async (req, res) => {
  try {
    const { customerId } = req.body;
    
    // Get customer from database
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    // Check if customer already has a Stripe ID
    if (customer.stripeCustomerId) {
      return res.json({
        success: true,
        message: 'Customer already has Stripe account',
        stripeCustomerId: customer.stripeCustomerId
      });
    }
    
    // Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      metadata: {
        customerId: customer._id.toString()
      }
    });
    
    // Save Stripe customer ID to database
    customer.stripeCustomerId = stripeCustomer.id;
    await customer.save();
    
    console.log(`✅ Stripe customer created: ${stripeCustomer.id} for ${customer.name}`);
    
    res.json({
      success: true,
      message: 'Stripe customer created',
      stripeCustomerId: stripeCustomer.id
    });
  } catch (err) {
    console.error('❌ Error creating Stripe customer:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create Stripe customer',
      error: err.message 
    });
  }
});

// 📄 POST /api/stripe/create-invoice - Create Stripe invoice
router.post('/create-invoice', requireAdminLogin, checkStripe, async (req, res) => {
  try {
    const { invoiceId } = req.body;
    
    // Get invoice from database
    const invoice = await Invoice.findById(invoiceId).populate('customerId');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Get or create Stripe customer
    let stripeCustomerId = invoice.customerId.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        name: invoice.customerName,
        email: invoice.customerEmail,
        metadata: {
          customerId: invoice.customerId._id.toString()
        }
      });
      stripeCustomerId = stripeCustomer.id;
      
      // Update customer record
      invoice.customerId.stripeCustomerId = stripeCustomerId;
      await invoice.customerId.save();
    }
    
    // Create Stripe invoice
    const stripeInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      auto_advance: false, // Don't auto-finalize
      collection_method: 'send_invoice',
      days_until_due: Math.ceil((invoice.dueDate - new Date()) / (1000 * 60 * 60 * 24)),
      metadata: {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber
      }
    });
    
    // Add line items
    for (const item of invoice.items) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_amount: Math.round(item.unitPrice * 100), // Convert to öre/cents
        currency: invoice.currency.toLowerCase()
      });
    }
    
    // Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    
    // Update database invoice
    invoice.stripeInvoiceId = finalizedInvoice.id;
    invoice.stripeCustomerId = stripeCustomerId;
    await invoice.save();
    
    console.log(`✅ Stripe invoice created: ${finalizedInvoice.id} for ${invoice.invoiceNumber}`);
    
    res.json({
      success: true,
      message: 'Stripe invoice created',
      stripeInvoice: finalizedInvoice,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url
    });
  } catch (err) {
    console.error('❌ Error creating Stripe invoice:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create Stripe invoice',
      error: err.message 
    });
  }
});

// 💳 POST /api/stripe/setup-payment-method - Setup payment method
router.post('/setup-payment-method', requireAdminLogin, checkStripe, async (req, res) => {
  try {
    const { customerId } = req.body;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      // Create Stripe customer if doesn't exist
      const stripeCustomer = await stripe.customers.create({
        name: customer.name,
        email: customer.email,
        metadata: {
          customerId: customer._id.toString()
        }
      });
      stripeCustomerId = stripeCustomer.id;
      customer.stripeCustomerId = stripeCustomerId;
      await customer.save();
    }
    
    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card', 'sepa_debit'],
    });
    
    res.json({
      success: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id
    });
  } catch (err) {
    console.error('❌ Error creating setup intent:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create setup intent',
      error: err.message 
    });
  }
});

// 🔄 POST /api/stripe/create-mandate - Create SEPA direct debit mandate
router.post('/create-mandate', requireAdminLogin, checkStripe, async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.body;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    if (!customer.stripeCustomerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer must have Stripe account first' 
      });
    }
    
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.stripeCustomerId,
    });
    
    // Set as default payment method
    await stripe.customers.update(customer.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    // Create mandate for SEPA direct debit
    const mandate = await stripe.mandates.retrieve(paymentMethodId);
    
    console.log(`✅ SEPA mandate created for ${customer.name}`);
    
    res.json({
      success: true,
      message: 'Direct debit mandate created',
      mandateId: mandate.id
    });
  } catch (err) {
    console.error('❌ Error creating mandate:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create mandate',
      error: err.message 
    });
  }
});

// 💰 POST /api/stripe/charge-invoice - Charge invoice
router.post('/charge-invoice', requireAdminLogin, checkStripe, async (req, res) => {
  try {
    const { invoiceId } = req.body;
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    if (!invoice.stripeInvoiceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invoice not connected to Stripe' 
      });
    }
    
    // Pay the invoice
    const paidInvoice = await stripe.invoices.pay(invoice.stripeInvoiceId);
    
    // Update database
    invoice.status = 'paid';
    invoice.paidDate = new Date();
    invoice.stripePaymentIntentId = paidInvoice.payment_intent;
    await invoice.save();
    
    console.log(`💰 Invoice ${invoice.invoiceNumber} paid via Stripe`);
    
    res.json({
      success: true,
      message: 'Invoice charged successfully',
      stripeInvoice: paidInvoice
    });
  } catch (err) {
    console.error('❌ Error charging invoice:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to charge invoice',
      error: err.message 
    });
  }
});

// 🔙 POST /api/stripe/refund - Refund payment
router.post('/refund', requireAdminLogin, checkStripe, async (req, res) => {
  try {
    const { invoiceId, amount, reason } = req.body;
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    if (!invoice.stripePaymentIntentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'No payment intent found for this invoice' 
      });
    }
    
    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: invoice.stripePaymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
      reason: reason || 'requested_by_customer'
    });
    
    // Update invoice status
    if (!amount || amount >= invoice.totalAmount) {
      invoice.status = 'refunded';
    }
    await invoice.save();
    
    console.log(`🔙 Refund processed for invoice ${invoice.invoiceNumber}`);
    
    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund
    });
  } catch (err) {
    console.error('❌ Error processing refund:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process refund',
      error: err.message 
    });
  }
});

// 🎣 POST /api/stripe/webhook - Stripe webhook handler
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;
  
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // For development without webhook signing
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  try {
    switch (event.type) {
      case 'invoice.paid':
        const paidInvoice = event.data.object;
        console.log(`🎣 Webhook: Invoice paid ${paidInvoice.id}`);
        
        // Update invoice in database
        const invoice = await Invoice.findOne({ stripeInvoiceId: paidInvoice.id });
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidDate = new Date(paidInvoice.status_transitions.paid_at * 1000);
          invoice.stripePaymentIntentId = paidInvoice.payment_intent;
          await invoice.save();
          console.log(`✅ Invoice ${invoice.invoiceNumber} marked as paid from webhook`);
        }
        break;
        
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log(`🎣 Webhook: Invoice payment failed ${failedInvoice.id}`);
        
        const failedDbInvoice = await Invoice.findOne({ stripeInvoiceId: failedInvoice.id });
        if (failedDbInvoice) {
          failedDbInvoice.status = 'overdue';
          await failedDbInvoice.save();
          console.log(`⚠️ Invoice ${failedDbInvoice.invoiceNumber} marked as overdue from webhook`);
        }
        break;
        
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log(`🎣 Webhook: Payment succeeded ${paymentIntent.id}`);
        break;
        
      case 'payment_method.attached':
        const paymentMethod = event.data.object;
        console.log(`🎣 Webhook: Payment method attached ${paymentMethod.id}`);
        break;
        
      default:
        console.log(`🎣 Unhandled event type ${event.type}`);
    }
    
    res.json({received: true});
  } catch (err) {
    console.error(`❌ Error handling webhook event ${event.type}:`, err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;

