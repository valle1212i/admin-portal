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

#### `POST /api/admin/direct-login`
Creates a direct login session for impersonated customer.

**Request Body:**
```json
{
  "sessionData": {
    "customerId": "customer_id",
    "customerEmail": "customer@example.com",
    "sessionToken": "jwt_token",
    "isImpersonated": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Direkt login lyckades",
  "customer": {
    "_id": "customer_id",
    "name": "Customer Name",
    "email": "customer@example.com"
  },
  "session": {
    "customerId": "customer_id",
    "customerEmail": "customer@example.com",
    "isImpersonated": true,
    "impersonatedBy": "admin_id",
    "impersonatedByName": "Admin Name",
    "impersonatedAt": "2025-01-11T...",
    "loginTime": "2025-01-11T..."
  }
}
```

#### `GET /api/admin/verify-impersonation`
Verifies impersonation token (legacy endpoint, still available).

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

To support impersonation in your customer portal, add this JavaScript to your main page (e.g., index.html or dashboard.html):

### 1. **Simple Impersonation Handler**
Add this code to your customer portal's main page:

```javascript
// Add this to your main customer portal page (index.html, dashboard.html, etc.)
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const impersonationToken = urlParams.get('impersonate');
  
  if (impersonationToken) {
    console.log('🔍 Impersonation token detected, verifying...');
    
    // Verify token with admin portal
    fetch('https://admin-portal-rn5z.onrender.com/api/admin/verify-impersonation?token=' + impersonationToken)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Impersonation verified, logging in customer:', data.customer.name);
          
          // Set customer session (bypass normal login)
          setCustomerSession(data.customer);
          
          // Show impersonation banner
          showImpersonationBanner(data.impersonation);
          
          // Remove token from URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
          
        } else {
          console.error('❌ Impersonation verification failed:', data.message);
          // Redirect to normal login page
          window.location.href = '/login';
        }
      })
      .catch(err => {
        console.error('❌ Error verifying impersonation token:', err);
        window.location.href = '/login';
      });
  }
});
```

### 2. **Session Management**
```javascript
function setCustomerSession(customer) {
  // Store customer data in session/localStorage
  sessionStorage.setItem('customer', JSON.stringify(customer));
  sessionStorage.setItem('isLoggedIn', 'true');
  
  // Set any other session variables your app needs
  // This bypasses the normal login flow
}

function showImpersonationBanner(session) {
  const banner = document.createElement('div');
  banner.className = 'impersonation-banner';
  banner.innerHTML = `
    <div class="banner-content">
      <span class="banner-icon">👤</span>
      <span class="banner-text">
        Impersonerar: ${session.impersonatedByName} 
        (${new Date(session.impersonatedAt).toLocaleString()})
      </span>
      <button onclick="exitImpersonation()" class="exit-btn">Avsluta</button>
    </div>
  `;
  document.body.insertBefore(banner, document.body.firstChild);
}

function exitImpersonation() {
  // Clear session and redirect to admin portal
  sessionStorage.clear();
  window.location.href = 'https://admin-portal-rn5z.onrender.com/dashboard';
}
```

### 3. **CSS for Impersonation Banner**
```css
.impersonation-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  padding: 12px 20px;
  z-index: 9999;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

.banner-icon {
  font-size: 18px;
}

.banner-text {
  font-weight: 500;
}

.exit-btn {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.exit-btn:hover {
  background: rgba(255,255,255,0.3);
}
```

## Environment Variables

Ensure these environment variables are set:

```env
# Customer portal URL for redirects
CUSTOMER_PORTAL_URL=https://source-database.onrender.com

# JWT secret for token signing (uses SESSION_SECRET if JWT_SECRET not set)
JWT_SECRET=your-secure-jwt-secret
SESSION_SECRET=your-session-secret

# Customer database connection
CUSTOMER_DB_URI=mongodb://your-customer-db-connection
```

**Note**: The impersonation system will use `SESSION_SECRET` if `JWT_SECRET` is not available, ensuring compatibility with existing deployments.

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
