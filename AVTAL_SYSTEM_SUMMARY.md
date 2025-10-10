# Avtal Management System - Implementation Summary

## Overview
A complete customer agreement management system with package-based access control (Bas, Grower, Enterprise), termination workflows, and customer portal integration.

## ✅ Completed Features

### 1. Database Schema (models/Customer.js, models/Contract.js)
- **Customer Model Extended:**
  - `package`: Enum ['Bas', 'Grower', 'Enterprise']
  - `packageChangeRequests`: Array with approval workflow
  - `maxUsers`, `currentUserCount`: User limit enforcement
  - `agreementStatus`: ['active', 'terminated', 'read_only']
  - `terminationDate`, `terminationEffectiveDate`, `terminationReason`
  - `dataRetentionUntil`, `billingCycleEnd`

- **Contract Model Extended:**
  - `packageType`: Associated package
  - `additionalDocuments`: Array of supplementary files
  - `terminatedAt`, `terminatedBy`: Termination tracking

### 2. Backend API Routes (routes/contracts.js)
All routes implemented with authorization checks:

**Search & Details:**
- `GET /api/contracts/search/customers?q=query` - Search customers
- `GET /api/contracts/customer/:customerId/details` - Get full customer details

**Package Management:**
- `POST /api/contracts/customer/:customerId/change-package` - Request package change
- `POST /api/contracts/package-change/:customerId/:requestId/approve` - Approve change
- `POST /api/contracts/package-change/:customerId/:requestId/reject` - Reject change

**Termination:**
- `POST /api/contracts/customer/:customerId/terminate` - Terminate agreement
  - Sets termination to end of current month
  - Automatically stops future invoices
  - Sets 12-month data retention period

**Documents:**
- `GET /api/contracts/:contractId/pdf` - Download contract as PDF
- `POST /api/contracts/:contractId/add-document` - Upload additional document

**Data Retention:**
- `POST /api/contracts/cleanup-expired` - Check for expired retention periods
- `POST /api/contracts/confirm-deletion/:customerId` - Manual deletion confirmation

**Authorization:**
Only these admins can approve packages/deletions:
- korpela.valentin@gmail.com
- vincent.korpela@gmail.com
- andre.soderberg@outlook.com

### 3. Frontend (public/avtal.html + js/avtal.js + css/avtal.css)

**Features:**
- ✅ Real-time customer search with debouncing
- ✅ Customer details display with status badges
- ✅ Package selector with immediate/next-billing options
- ✅ Pending approval requests display
- ✅ Approve/reject buttons for authorized admins
- ✅ Contracts list with download capability
- ✅ Upload additional documents
- ✅ Termination workflow with confirmation modal
- ✅ Termination status display for terminated accounts
- ✅ Professional card-based design matching invoicing system

**Modals:**
- Upload new contract
- Termination confirmation
- Add additional document

### 4. Invoice Integration (routes/invoices.js)
- `stopFutureInvoices(customerId, effectiveDate)` function
- Automatically cancels pending/draft invoices after termination date
- Integrated with contracts termination workflow

### 5. Data Retention Service (services/dataRetention.js)
- `checkDataRetentionDeadlines()` - Find customers approaching deletion (30 days)
- `getCustomersReadyForDeletion()` - List customers past retention date
- `archiveCustomerData(customerId)` - Archive before deletion
- `deleteCustomerData(customerId, confirmedBy)` - Manual deletion
- `sendDataRetentionWarning(customers)` - Email notifications
- `runDailyDataRetentionCheck()` - Cron job function

### 6. Customer Portal Integration Guide
**CUSTOMER_PORTAL_PACKAGE_INTEGRATION.md** provides:
- Complete middleware implementation (`checkPageAccess.js`)
- Page access matrix for all packages
- Navigation filtering by package
- User limit enforcement
- API sync endpoint specification
- Read-only access for terminated accounts

## Package Access Matrix

### Bas Package (Max 2 users)
15 pages: betalningar, rapporter, customerportal, chatwindow, case-details, betalning, case-detail, faq, installningar, profile, support-ticket, login, chatt-redirect, invoice, kontakt

### Grower Package (Max 5 users)
Bas + 8 pages: betalningslank, googleleads, metaads, radgivning, tiktokads, kundmeddelande, marknadsforing, linkedin

### Enterprise Package (Max 10 users)
Grower + 2 pages: analytics, inventarier

## User Workflows

### Change Package Workflow
1. Admin searches for customer
2. Selects new package and effective date (immediate/next billing)
3. Clicks "Begär paketändring"
4. Authorized admin approves or rejects
5. If immediate: package updates instantly
6. If next billing: scheduled for next cycle
7. Customer portal syncs access automatically

### Termination Workflow
1. Admin searches for customer
2. Views customer details
3. Clicks "Säg upp avtal"
4. Enters termination reason
5. Confirms action
6. System:
   - Sets termination date to now
   - Sets effective date to end of current month
   - Customer has full access until end of month
   - After effective date: account goes to read-only
   - Cancels all future invoices
   - Sets data retention to 12 months
7. After 12 months:
   - Admin receives warning 30 days before deletion
   - Manual confirmation required
   - Data archived then deleted

### Agreement Management Workflow
1. Search customer by name/email
2. View all contracts and documents
3. Upload new contracts or additional documents
4. Download contracts as PDF
5. Track package history
6. View pending package change requests
7. Monitor termination status

## Technical Implementation

### Authorization
```javascript
const AUTHORIZED_ADMINS = [
  'korpela.valentin@gmail.com',
  'vincent.korpela@gmail.com',
  'andre.soderberg@outlook.com'
];
```

### Package Change Request Structure
```javascript
{
  requestedPackage: 'Grower',
  requestedBy: 'admin@email.com',
  requestedAt: Date,
  approvedBy: 'authorized@email.com',
  approvedAt: Date,
  status: 'pending|approved|rejected',
  effectiveDate: 'immediate|next_billing'
}
```

### Termination Calculation
```javascript
const now = new Date();
const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
const dataRetentionUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
```

## Files Created/Modified

### New Files
- `public/avtal.html` - Main agreement management page
- `public/css/avtal.css` - Styling for avtal page
- `public/js/avtal.js` - Frontend JavaScript functionality
- `services/dataRetention.js` - Data retention service
- `CUSTOMER_PORTAL_PACKAGE_INTEGRATION.md` - Integration guide

### Modified Files
- `models/Customer.js` - Extended with package fields
- `models/Contract.js` - Extended with termination fields
- `routes/contracts.js` - All new API routes
- `routes/invoices.js` - Added stopFutureInvoices function

## Next Steps (Customer Portal Team)

1. **Add package field to customer schema**
2. **Implement checkPageAccess middleware**
3. **Update navigation menu filtering**
4. **Add user count enforcement**
5. **Create package sync API endpoint**
6. **Test access control for all packages**

## Cron Job Setup (Optional)

To enable automated data retention checks:

```javascript
// In server.js or separate cron file
const cron = require('node-cron');
const { runDailyDataRetentionCheck } = require('./services/dataRetention');

// Run daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  await runDailyDataRetentionCheck();
});
```

## Testing Checklist

- [ ] Search customers by name and email
- [ ] Select customer and view details
- [ ] Request package change
- [ ] Approve package change (authorized admin)
- [ ] Reject package change (authorized admin)
- [ ] Upload new contract
- [ ] Download contract as PDF
- [ ] Add additional document
- [ ] Terminate agreement
- [ ] Verify future invoices are cancelled
- [ ] Check termination status display
- [ ] Verify data retention dates
- [ ] Test unauthorized access (non-authorized admin)

## Security Considerations

✅ Authorization checks on all sensitive operations
✅ Package approval limited to 3 specific admins
✅ Manual confirmation required for data deletion
✅ 30-day warning before deletion
✅ Data archival before deletion
✅ Audit trail with timestamps and user tracking
✅ Session-based authentication required

## Support

For questions or issues:
- Check CUSTOMER_PORTAL_PACKAGE_INTEGRATION.md for integration details
- Review API routes in routes/contracts.js
- Check data retention logic in services/dataRetention.js

