# Customer Portal Package Integration Guide

This document provides instructions for integrating package-based access control into the Source Customer Portal.

## Overview

The admin portal now manages three customer packages (**Bas**, **Grower**, **Enterprise**) with different feature access levels. The customer portal needs to implement middleware and UI changes to restrict access based on the customer's package.

## Package Access Matrix

### Bas Package (Max 2 users)
**Accessible Pages:**
- `betalningar.html` - Payments
- `rapporter.html` - Reports
- `customerportal.html` - Main dashboard
- `chatwindow.html` - Chat window
- `case-details.html` - Case details
- `betalning.html` - Payment page
- `case-detail.html` - Case detail
- `faq.html` - FAQ
- `installningar.html` - Settings
- `profile.html` - Profile
- `support-ticket.html` - Support tickets
- `login.html` - Login
- `chatt-redirect.html` - Chat redirect
- `invoice.html` - Invoice
- `kontakt.html` - Contact

### Grower Package (Max 5 users)
**All Bas pages PLUS:**
- `betalningslank.html` - Payment link
- `googleleads.html` - Google Leads
- `metaads.html` - Meta Ads
- `radgivning.html` - Advisory
- `tiktokads.html` - TikTok Ads
- `kundmeddelande.html` - Customer message
- `marknadsforing.html` - Marketing
- `linkedin.html` - LinkedIn

### Enterprise Package (Max 10 users)
**All Grower pages PLUS:**
- `analytics.html` - Analytics
- `inventarier.html` - Inventory

## Implementation Steps

### 1. Update Customer Schema

Add the following fields to your Customer model:

```javascript
// In your customer schema file
{
  package: { 
    type: String, 
    enum: ['Bas', 'Grower', 'Enterprise'], 
    default: 'Bas' 
  },
  maxUsers: { 
    type: Number, 
    default: 2 
  },
  currentUserCount: { 
    type: Number, 
    default: 1 
  },
  agreementStatus: { 
    type: String, 
    enum: ['active', 'terminated', 'read_only'], 
    default: 'active' 
  }
}
```

### 2. Create Page Access Middleware

Create a new file `middleware/checkPageAccess.js`:

```javascript
// middleware/checkPageAccess.js

const pageAccessMap = {
  'Bas': [
    'betalningar.html',
    'rapporter.html',
    'customerportal.html',
    'chatwindow.html',
    'case-details.html',
    'betalning.html',
    'case-detail.html',
    'faq.html',
    'installningar.html',
    'profile.html',
    'support-ticket.html',
    'login.html',
    'chatt-redirect.html',
    'invoice.html',
    'kontakt.html'
  ],
  'Grower': [
    // All Bas pages
    'betalningar.html',
    'rapporter.html',
    'customerportal.html',
    'chatwindow.html',
    'case-details.html',
    'betalning.html',
    'case-detail.html',
    'faq.html',
    'installningar.html',
    'profile.html',
    'support-ticket.html',
    'login.html',
    'chatt-redirect.html',
    'invoice.html',
    'kontakt.html',
    // Grower-specific pages
    'betalningslank.html',
    'googleleads.html',
    'metaads.html',
    'radgivning.html',
    'tiktokads.html',
    'kundmeddelande.html',
    'marknadsforing.html',
    'linkedin.html'
  ],
  'Enterprise': [
    // All Grower pages
    'betalningar.html',
    'rapporter.html',
    'customerportal.html',
    'chatwindow.html',
    'case-details.html',
    'betalning.html',
    'case-detail.html',
    'faq.html',
    'installningar.html',
    'profile.html',
    'support-ticket.html',
    'login.html',
    'chatt-redirect.html',
    'invoice.html',
    'kontakt.html',
    'betalningslank.html',
    'googleleads.html',
    'metaads.html',
    'radgivning.html',
    'tiktokads.html',
    'kundmeddelande.html',
    'marknadsforing.html',
    'linkedin.html',
    // Enterprise-specific pages
    'analytics.html',
    'inventarier.html'
  ]
};

function checkPageAccess(req, res, next) {
  // Get the requested page
  const requestedPage = req.path.split('/').pop();
  
  // Skip check for login and public pages
  if (requestedPage === 'login.html' || !requestedPage.endsWith('.html')) {
    return next();
  }

  // Get customer package from session
  const customerPackage = req.session?.customer?.package || 'Bas';
  const allowedPages = pageAccessMap[customerPackage] || pageAccessMap['Bas'];

  // Check if customer has access to the requested page
  if (allowedPages.includes(requestedPage)) {
    return next();
  }

  // Return 403 Forbidden if no access
  res.status(403).render('403', { 
    message: 'Din nuvarande paket ger inte tillgång till denna sida. Kontakta support för att uppgradera.' 
  });
}

module.exports = checkPageAccess;
```

### 3. Apply Middleware to Routes

In your main server file (e.g., `server.js` or `app.js`):

```javascript
const checkPageAccess = require('./middleware/checkPageAccess');

// Apply to all HTML routes
app.use(checkPageAccess);
```

### 4. Update Navigation Menu

Update your navigation menu to hide items based on package. Example:

```javascript
// In your frontend JavaScript
async function loadNavigation() {
  const customer = await getCurrentCustomer(); // Your function to get customer data
  const package = customer.package || 'Bas';
  
  // Define menu items with required packages
  const menuItems = [
    { page: 'customerportal.html', label: 'Dashboard', requiredPackage: 'Bas' },
    { page: 'betalningar.html', label: 'Betalningar', requiredPackage: 'Bas' },
    { page: 'marknadsforing.html', label: 'Marknadsföring', requiredPackage: 'Grower' },
    { page: 'analytics.html', label: 'Analytics', requiredPackage: 'Enterprise' },
    { page: 'inventarier.html', label: 'Inventarier', requiredPackage: 'Enterprise' }
  ];
  
  // Filter menu items based on package
  const allowedItems = menuItems.filter(item => hasAccess(package, item.requiredPackage));
  
  // Render navigation
  renderNavigation(allowedItems);
}

function hasAccess(customerPackage, requiredPackage) {
  const packageLevels = { 'Bas': 1, 'Grower': 2, 'Enterprise': 3 };
  return packageLevels[customerPackage] >= packageLevels[requiredPackage];
}
```

### 5. User Limit Enforcement

Add user count validation when creating new users:

```javascript
// When creating a new user/team member
async function createUser(customerId, userData) {
  const customer = await Customer.findById(customerId);
  
  // Check if customer has reached max users
  if (customer.currentUserCount >= customer.maxUsers) {
    throw new Error(
      `Du har nått maxgränsen för användare (${customer.maxUsers}). ` +
      `Uppgradera ditt paket för att lägga till fler användare.`
    );
  }
  
  // Create user
  const newUser = await User.create(userData);
  
  // Increment user count
  customer.currentUserCount += 1;
  await customer.save();
  
  return newUser;
}

// When deleting a user
async function deleteUser(customerId, userId) {
  await User.findByIdAndDelete(userId);
  
  // Decrement user count
  await Customer.findByIdAndUpdate(
    customerId,
    { $inc: { currentUserCount: -1 } }
  );
}
```

### 6. Create API Endpoint for Package Sync

Create an endpoint to receive package updates from the admin portal:

```javascript
// routes/packageSync.js
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');

// Sync package update from admin portal
router.post('/sync/package-update', async (req, res) => {
  try {
    const { customerId, package, maxUsers } = req.body;
    
    // Verify request is from admin portal (add your authentication here)
    // e.g., check API key, JWT token, etc.
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    // Update package
    customer.package = package;
    customer.maxUsers = maxUsers;
    
    // Check if current users exceed new limit
    if (customer.currentUserCount > maxUsers) {
      // You may want to handle this differently
      console.warn(`Customer ${customerId} has more users than new limit`);
    }
    
    await customer.save();
    
    res.json({ success: true, message: 'Package updated successfully' });
  } catch (err) {
    console.error('Error syncing package:', err);
    res.status(500).json({ success: false, message: 'Error updating package' });
  }
});

module.exports = router;
```

### 7. Handle Read-Only Access for Terminated Accounts

Add middleware to check agreement status:

```javascript
// middleware/checkAgreementStatus.js
function checkAgreementStatus(req, res, next) {
  const customer = req.session?.customer;
  
  if (!customer) {
    return next();
  }
  
  // If agreement is terminated or in read-only mode
  if (customer.agreementStatus === 'read_only' || customer.agreementStatus === 'terminated') {
    // Check if trying to access read-only pages
    const readOnlyPages = ['betalningar.html', 'rapporter.html', 'invoice.html', 'profile.html'];
    const requestedPage = req.path.split('/').pop();
    
    if (!readOnlyPages.includes(requestedPage)) {
      return res.status(403).render('403', { 
        message: 'Ditt avtal har sagts upp. Du har endast tillgång till rapporter och betalningsinformation.' 
      });
    }
  }
  
  next();
}

module.exports = checkAgreementStatus;
```

## Testing Checklist

- [ ] Bas users can only access Bas pages
- [ ] Grower users can access Bas + Grower pages
- [ ] Enterprise users can access all pages
- [ ] Navigation menu hides unauthorized items
- [ ] 403 error shows when accessing unauthorized pages
- [ ] User creation is blocked when max users reached
- [ ] Package sync endpoint works correctly
- [ ] Read-only access works for terminated accounts
- [ ] User count increments/decrements correctly

## Admin Portal Integration

The admin portal will call your sync endpoint when packages are changed:

```javascript
// From admin portal
async function syncWithCustomerPortal(customerId, package, maxUsers) {
  const response = await fetch('https://source-database.onrender.com/api/sync/package-update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY' // Add authentication
    },
    body: JSON.stringify({ customerId, package, maxUsers })
  });
  
  return response.json();
}
```

## Notes

- Make sure to add proper authentication to the package sync endpoint
- Consider adding logging for all package changes
- Implement proper error handling for edge cases
- Test thoroughly with different package combinations
- Consider adding upgrade prompts in the UI when users try to access restricted features
- Implement proper session management to refresh package info after changes

## Support

For questions or issues with this integration, contact the admin portal team.

