# Admin Impersonation Guide

## Overview
The admin portal now includes a powerful impersonation feature that allows owners and admins to view the customer portal from the customer's perspective with full access rights.

## Features

### 🎨 **Improved Customer Page Design**
- **Modern Card Layout**: Customer information is now displayed in an attractive grid of cards
- **Visual Hierarchy**: Clear separation between customer info, cases, and chat messages
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Interactive Elements**: Hover effects and smooth transitions for better UX

### 👤 **Impersonation Button**
- **Prominent Placement**: Located in the top-right corner of the customer information section
- **Visual Feedback**: Shows loading state during impersonation process
- **Confirmation Dialog**: Asks for confirmation before proceeding
- **Secure Implementation**: Uses JWT tokens with expiration for security

## How It Works

### 1. **Accessing Impersonation**
1. Navigate to any customer's profile page (`/admin-customer.html?id=CUSTOMER_ID`)
2. Click the "Impersonera Kund" button in the top-right corner
3. Confirm the action in the dialog box
4. The system opens the customer portal in a new tab with full customer access

### 2. **Security Features**
- **Admin Authentication**: Only logged-in admins can impersonate
- **Role-Based Access**: Only owners and admins have impersonation rights
- **JWT Tokens**: Secure tokens with 1-hour expiration
- **Audit Logging**: All impersonation events are logged
- **Customer Verification**: System verifies customer still exists before impersonation

### 3. **API Endpoints**

#### `POST /api/admin/impersonate`
Creates an impersonation token and returns redirect URL.

**Request Body:**
```json
{
  "customerId": "customer_id_here",
  "customerEmail": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Impersonation token skapad",
  "redirectUrl": "https://customer-portal.com/impersonate?token=...",
  "customer": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "id": "customer_id"
  }
}
```

#### `GET /api/admin/verify-impersonation`
Verifies impersonation token (called from customer portal).

**Query Parameters:**
- `token`: JWT impersonation token

**Response:**
```json
{
  "success": true,
  "customer": {
    "_id": "customer_id",
    "name": "Customer Name",
    "email": "customer@example.com"
  },
  "impersonation": {
    "impersonatedBy": "admin_id",
    "impersonatedByName": "Admin Name",
    "impersonatedAt": "2025-01-11T..."
  }
}
```

## Customer Portal Integration

To support impersonation in your customer portal, implement the following:

### 1. **Token Verification**
```javascript
// Check for impersonation token in URL
const urlParams = new URLSearchParams(window.location.search);
const impersonationToken = urlParams.get('token');

if (impersonationToken) {
  // Verify token with admin portal
  fetch(`https://admin-portal.com/api/admin/verify-impersonation?token=${impersonationToken}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Set customer session with impersonated user
        setCustomerSession(data.customer);
        showImpersonationBanner(data.impersonation);
      }
    });
}
```

### 2. **Impersonation Banner**
Show a banner indicating impersonation mode:
```javascript
function showImpersonationBanner(impersonation) {
  const banner = document.createElement('div');
  banner.className = 'impersonation-banner';
  banner.innerHTML = `
    <div class="banner-content">
      <span class="banner-icon">👤</span>
      <span class="banner-text">
        Impersonerar: ${impersonation.impersonatedByName} 
        (${new Date(impersonation.impersonatedAt).toLocaleString()})
      </span>
      <button onclick="exitImpersonation()" class="exit-btn">Avsluta</button>
    </div>
  `;
  document.body.insertBefore(banner, document.body.firstChild);
}
```

## Environment Variables

Ensure these environment variables are set:

```env
# Customer portal URL for redirects
CUSTOMER_PORTAL_URL=https://your-customer-portal.com

# JWT secret for token signing
JWT_SECRET=your-secure-jwt-secret

# Customer database connection
CUSTOMER_DB_URI=mongodb://your-customer-db-connection
```

## Security Considerations

1. **Token Expiration**: Impersonation tokens expire after 1 hour
2. **Admin Verification**: Only authenticated admins can create tokens
3. **Role-Based Access**: Restrict impersonation to owners/admins only
4. **Audit Logging**: Log all impersonation events for security
5. **Customer Validation**: Verify customer exists before impersonation

## Styling

The new design includes:
- **CSS Grid Layout**: Responsive customer details grid
- **Card-Based Design**: Clean, modern card layout
- **Hover Effects**: Interactive elements with smooth transitions
- **Mobile Responsive**: Optimized for all screen sizes
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Troubleshooting

### Common Issues:
1. **"Kunddata inte tillgänglig"**: Customer data failed to load
2. **"Otillräcklig behörighet"**: User doesn't have admin/owner role
3. **"Token har gått ut"**: Impersonation token expired
4. **"Kund hittades inte"**: Customer ID doesn't exist in database

### Debug Steps:
1. Check admin session and role
2. Verify customer exists in database
3. Check JWT_SECRET environment variable
4. Verify CUSTOMER_PORTAL_URL is correct
5. Check browser console for JavaScript errors
