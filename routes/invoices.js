const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const Customer = require('../models/Customer');
const requireAdminLogin = require('../middleware/requireAdminLogin');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// All routes require admin authentication
router.use(requireAdminLogin);

// Helper function to stop future invoices when agreement is terminated
async function stopFutureInvoices(customerId, effectiveDate) {
  try {
    const result = await Invoice.updateMany(
      { 
        customerId, 
        dueDate: { $gt: effectiveDate },
        status: { $in: ['draft', 'pending'] }
      },
      { 
        status: 'cancelled',
        cancelledReason: 'Agreement terminated',
        cancelledDate: new Date()
      }
    );
    
    console.log(`Stopped ${result.modifiedCount} future invoices for customer ${customerId}`);
    return result;
  } catch (err) {
    console.error('Error stopping future invoices:', err);
    throw err;
  }
}

// Export for use in contracts route
router.stopFutureInvoices = stopFutureInvoices;

// 📊 GET /api/invoices/stats - Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const totalInvoices = await Invoice.countDocuments();
    
    // Pending amount (sum of all pending and overdue invoices)
    const pendingInvoices = await Invoice.aggregate([
      { $match: { status: { $in: ['pending', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const pendingAmount = pendingInvoices.length > 0 ? pendingInvoices[0].total : 0;
    
    // Overdue count
    const overdueCount = await Invoice.countDocuments({ status: 'overdue' });
    
    // Paid this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const paidThisMonth = await Invoice.aggregate([
      { 
        $match: { 
          status: 'paid',
          paidDate: { $gte: startOfMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const paidAmount = paidThisMonth.length > 0 ? paidThisMonth[0].total : 0;
    
    res.json({
      success: true,
      stats: {
        totalInvoices,
        pendingAmount,
        overdueCount,
        paidThisMonth: paidAmount
      }
    });
  } catch (err) {
    console.error('❌ Error fetching invoice stats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// 🔍 GET /api/invoices/customers - Get all customers with invoice summary
router.get('/customers', async (req, res) => {
  try {
    const { search, filter } = req.query;
    
    // Build aggregation pipeline
    const pipeline = [];
    
    // Group by customer
    pipeline.push({
      $group: {
        _id: '$customerId',
        customerName: { $first: '$customerName' },
        customerEmail: { $first: '$customerEmail' },
        totalInvoices: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        overdueCount: {
          $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
        },
        pendingCount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        paidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        }
      }
    });
    
    // Apply filters
    if (filter && filter !== 'all') {
      if (filter === 'overdue') {
        pipeline.push({ $match: { overdueCount: { $gt: 0 } } });
      } else if (filter === 'pending') {
        pipeline.push({ $match: { pendingCount: { $gt: 0 } } });
      } else if (filter === 'paid') {
        pipeline.push({ $match: { paidCount: { $gt: 0 } } });
      }
    }
    
    // Apply search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { customerName: searchRegex },
            { customerEmail: searchRegex }
          ]
        }
      });
    }
    
    // Sort by total amount descending
    pipeline.push({ $sort: { totalAmount: -1 } });
    
    const customers = await Invoice.aggregate(pipeline);
    
    res.json({
      success: true,
      customers
    });
  } catch (err) {
    console.error('❌ Error fetching customers:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
});

// 👤 GET /api/invoices/customer/:customerId - Get all invoices for customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Fetch customer info
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    // Fetch all invoices for this customer
    const invoices = await Invoice.find({ customerId })
      .sort({ invoiceDate: -1 })
      .populate('createdBy', 'name email');
    
    // Calculate summary stats
    const stats = {
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      paidAmount: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.totalAmount, 0),
      pendingAmount: invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.totalAmount, 0),
      overdueAmount: invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.totalAmount, 0),
      directDebitEnabled: invoices.some(inv => inv.directDebit.enabled)
    };
    
    res.json({
      success: true,
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email
      },
      invoices,
      stats
    });
  } catch (err) {
    console.error('❌ Error fetching customer invoices:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
  }
});

// 📄 GET /api/invoices/:invoiceId - Get single invoice details
router.get('/:invoiceId', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate('createdBy', 'name email')
      .populate('customerId', 'name email');
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    res.json({
      success: true,
      invoice
    });
  } catch (err) {
    console.error('❌ Error fetching invoice:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice' });
  }
});

// ➕ POST /api/invoices/create - Create new invoice
router.post('/create', async (req, res) => {
  try {
    const { customerId, items, dueDate, paymentMethod, notes } = req.body;
    
    // Validate customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    // Generate invoice number
    const invoiceNumber = await Invoice.generateInvoiceNumber();
    
    // Calculate item amounts
    const processedItems = items.map(item => ({
      ...item,
      amount: item.quantity * item.unitPrice
    }));
    
    // Create invoice
    const invoice = new Invoice({
      customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      invoiceNumber,
      items: processedItems,
      dueDate: new Date(dueDate),
      paymentMethod,
      notes,
      createdBy: req.session.admin._id
    });
    
    // Calculate totals
    invoice.calculateTotals();
    
    // Save invoice
    await invoice.save();
    
    console.log(`✅ Invoice ${invoiceNumber} created for ${customer.name}`);
    
    res.json({
      success: true,
      message: 'Invoice created successfully',
      invoice
    });
  } catch (err) {
    console.error('❌ Error creating invoice:', err);
    res.status(500).json({ success: false, message: 'Failed to create invoice' });
  }
});

// 📅 PUT /api/invoices/:invoiceId/postpone - Postpone due date
router.put('/:invoiceId/postpone', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { newDueDate, reason } = req.body;
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Add to postponement history
    invoice.postponementHistory.push({
      oldDate: invoice.dueDate,
      newDate: new Date(newDueDate),
      reason,
      postponedBy: req.session.admin._id
    });
    
    // Update due date
    invoice.dueDate = new Date(newDueDate);
    
    // Update status if it was overdue
    if (invoice.status === 'overdue' && invoice.dueDate > new Date()) {
      invoice.status = 'pending';
    }
    
    await invoice.save();
    
    console.log(`📅 Invoice ${invoice.invoiceNumber} postponed to ${newDueDate}`);
    
    res.json({
      success: true,
      message: 'Due date postponed successfully',
      invoice
    });
  } catch (err) {
    console.error('❌ Error postponing invoice:', err);
    res.status(500).json({ success: false, message: 'Failed to postpone invoice' });
  }
});

// 💰 PUT /api/invoices/:invoiceId/change-price - Change invoice price
router.put('/:invoiceId/change-price', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { newSubtotal, reason } = req.body;
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Cannot change price of paid invoices
    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Cannot change price of paid invoice' });
    }
    
    // Add to price change history
    invoice.priceChangeHistory.push({
      oldAmount: invoice.totalAmount,
      newAmount: Math.round(newSubtotal * (1 + invoice.taxRate / 100)),
      reason,
      changedBy: req.session.admin._id
    });
    
    // Update amounts
    invoice.subtotal = parseFloat(newSubtotal);
    invoice.taxAmount = Math.round(invoice.subtotal * (invoice.taxRate / 100));
    invoice.totalAmount = invoice.subtotal + invoice.taxAmount;
    
    await invoice.save();
    
    console.log(`💰 Invoice ${invoice.invoiceNumber} price changed to ${invoice.totalAmount} SEK`);
    
    res.json({
      success: true,
      message: 'Price updated successfully',
      invoice
    });
  } catch (err) {
    console.error('❌ Error changing price:', err);
    res.status(500).json({ success: false, message: 'Failed to change price' });
  }
});

// ✅ PUT /api/invoices/:invoiceId/mark-paid - Mark as paid
router.put('/:invoiceId/mark-paid', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { paidDate } = req.body;
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    invoice.status = 'paid';
    invoice.paidDate = paidDate ? new Date(paidDate) : new Date();
    
    await invoice.save();
    
    console.log(`✅ Invoice ${invoice.invoiceNumber} marked as paid`);
    
    res.json({
      success: true,
      message: 'Invoice marked as paid',
      invoice
    });
  } catch (err) {
    console.error('❌ Error marking invoice as paid:', err);
    res.status(500).json({ success: false, message: 'Failed to mark as paid' });
  }
});

// ❌ PUT /api/invoices/:invoiceId/cancel - Cancel invoice
router.put('/:invoiceId/cancel', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Cannot cancel paid invoices
    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Cannot cancel paid invoice. Use refund instead.' });
    }
    
    invoice.status = 'cancelled';
    await invoice.save();
    
    console.log(`❌ Invoice ${invoice.invoiceNumber} cancelled`);
    
    res.json({
      success: true,
      message: 'Invoice cancelled',
      invoice
    });
  } catch (err) {
    console.error('❌ Error cancelling invoice:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel invoice' });
  }
});

// 📥 GET /api/invoices/:invoiceId/pdf - Download PDF
router.get('/:invoiceId/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate('customerId', 'name email address');
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Company header
    doc.fontSize(20).text('Source', 50, 50);
    doc.fontSize(10).text('Everything You Need In One Place', 50, 75);
    
    // Invoice title
    doc.fontSize(24).text('FAKTURA', 400, 50);
    doc.fontSize(12).text(invoice.invoiceNumber, 400, 80);
    
    // Invoice details
    doc.fontSize(10);
    doc.text(`Fakturadatum: ${invoice.invoiceDate.toLocaleDateString('sv-SE')}`, 400, 100);
    doc.text(`Förfallodag: ${invoice.dueDate.toLocaleDateString('sv-SE')}`, 400, 115);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 400, 130);
    
    // Customer details
    doc.fontSize(12).text('Kund:', 50, 150);
    doc.fontSize(10);
    doc.text(invoice.customerName, 50, 170);
    doc.text(invoice.customerEmail, 50, 185);
    
    // Line items table
    const tableTop = 250;
    doc.fontSize(10).text('Beskrivning', 50, tableTop);
    doc.text('Antal', 300, tableTop);
    doc.text('Pris', 370, tableTop);
    doc.text('Belopp', 450, tableTop);
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    
    let yPosition = tableTop + 25;
    invoice.items.forEach((item) => {
      doc.text(item.description, 50, yPosition);
      doc.text(item.quantity.toString(), 300, yPosition);
      doc.text(`${item.unitPrice} SEK`, 370, yPosition);
      doc.text(`${item.amount} SEK`, 450, yPosition);
      yPosition += 20;
    });
    
    // Totals
    yPosition += 20;
    doc.moveTo(350, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 10;
    
    doc.text('Delsumma:', 350, yPosition);
    doc.text(`${invoice.subtotal} SEK`, 450, yPosition);
    yPosition += 20;
    
    doc.text(`Moms (${invoice.taxRate}%):`, 350, yPosition);
    doc.text(`${invoice.taxAmount} SEK`, 450, yPosition);
    yPosition += 20;
    
    doc.fontSize(12).text('Total:', 350, yPosition);
    doc.text(`${invoice.totalAmount} SEK`, 450, yPosition);
    
    // Payment info
    yPosition += 40;
    doc.fontSize(10).text('Betalningsinformation:', 50, yPosition);
    yPosition += 15;
    doc.fontSize(9);
    doc.text('Bankgiro: 123-4567', 50, yPosition);
    doc.text('Swish: 123 456 78 90', 50, yPosition + 15);
    doc.text(`Referens: ${invoice.invoiceNumber}`, 50, yPosition + 30);
    
    // Footer
    doc.fontSize(8).text(
      'Source AB | Org.nr: 559999-9999 | info@source.se',
      50,
      750,
      { align: 'center' }
    );
    
    // Finalize PDF
    doc.end();
    
    console.log(`📥 PDF generated for invoice ${invoice.invoiceNumber}`);
  } catch (err) {
    console.error('❌ Error generating PDF:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
});

// 🔄 POST /api/invoices/:invoiceId/direct-debit - Setup direct debit
router.post('/:invoiceId/direct-debit', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { enable, mandateId } = req.body;
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    invoice.directDebit.enabled = enable;
    if (enable) {
      invoice.directDebit.mandateId = mandateId;
      invoice.directDebit.setupAt = new Date();
      invoice.paymentMethod = 'direct_debit';
    }
    
    await invoice.save();
    
    console.log(`🔄 Direct debit ${enable ? 'enabled' : 'disabled'} for invoice ${invoice.invoiceNumber}`);
    
    res.json({
      success: true,
      message: `Direct debit ${enable ? 'enabled' : 'disabled'}`,
      invoice
    });
  } catch (err) {
    console.error('❌ Error updating direct debit:', err);
    res.status(500).json({ success: false, message: 'Failed to update direct debit' });
  }
});

// 🗑️ DELETE /api/invoices/:invoiceId - Delete invoice (admin only)
router.delete('/:invoiceId', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Can only delete draft or cancelled invoices
    if (!['draft', 'cancelled'].includes(invoice.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only delete draft or cancelled invoices' 
      });
    }
    
    await Invoice.findByIdAndDelete(req.params.invoiceId);
    
    console.log(`🗑️ Invoice ${invoice.invoiceNumber} deleted`);
    
    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (err) {
    console.error('❌ Error deleting invoice:', err);
    res.status(500).json({ success: false, message: 'Failed to delete invoice' });
  }
});

module.exports = router;

