# Environment Variables Setup

## Required Environment Variables

To enable package synchronization between the admin portal and customer portal, you need to add these environment variables to your deployment:

### Customer Portal Integration (NEW - Add these)
```bash
CUSTOMER_PORTAL_URL=https://source-database.onrender.com
ADMIN_SHARED_SECRET=your-shared-secret-here
```

### Existing Variables (already configured in Render)
```bash
MONGO_URI=mongodb+srv://valentinkorpela:valentinkorpela@cluster0.8qj8j.mongodb.net/AdminPanel?retryWrites=true&w=majority
CUSTOMER_DB_URI=mongodb+srv://valentinkorpela:valentinkorpela@cluster0.8qj8j.mongodb.net/kundportal?retryWrites=true&w=majority
```

### Missing Variables (need to be added)
```bash
SESSION_SECRET=your-session-secret-here
PORT=3000
```

## Setup Instructions

1. **Add Missing Environment Variables to Render:**
   - Go to your Render dashboard
   - Navigate to your admin portal service
   - Go to Environment tab
   - Add these NEW variables:
     - `CUSTOMER_PORTAL_URL` = `https://source-database.onrender.com`
     - `ADMIN_SHARED_SECRET` = `[same secret as customer portal]`
     - `SESSION_SECRET` = `[generate a random secret]`
     - `PORT` = `3000`

2. **Verify Configuration:**
   - Test the connection: `GET /api/contracts/test-customer-portal`
   - Should return success if both portals are configured correctly

3. **Get the Shared Secret:**
   - Contact the customer portal team to get the `ADMIN_SHARED_SECRET` value
   - This must be the same secret used in both portals for HMAC verification

## Security Notes

- The `ADMIN_SHARED_SECRET` must be the same in both portals
- Use a strong, random secret (at least 32 characters)
- Never commit secrets to version control
- Use environment variables for all sensitive configuration
