# Dashboard Integration Guide

## Overview
The admin dashboard now displays real-time data from the customer portal database. The widgets show:
- **Total Customers**: Count of all customers in `kundportal.customers`
- **Active Customers**: Currently same as total customers (can be customized later)
- **Currently Online**: Count of users who have been active in the last 5 minutes

## API Endpoints

### GET `/api/dashboard/stats`
Returns dashboard statistics:
```json
{
  "totalCustomers": 16,
  "activeCustomers": 16,
  "currentlyOnline": 3
}
```

### POST `/api/dashboard/user-online`
Updates a user's online status (called from customer portal):
```json
{
  "userId": "user_id_here",
  "isOnline": true
}
```

## Customer Portal Integration

To track online users, the customer portal should call the `/api/dashboard/user-online` endpoint:

### On User Login
```javascript
fetch('/api/dashboard/user-online', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser._id,
    isOnline: true
  })
});
```

### On User Activity (Heartbeat)
```javascript
// Call every 2-3 minutes to keep user online
setInterval(() => {
  fetch('/api/dashboard/user-online', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser._id,
      isOnline: true
    })
  });
}, 120000); // 2 minutes
```

### On User Logout
```javascript
fetch('/api/dashboard/user-online', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser._id,
    isOnline: false
  })
});
```

## Database Schema

The system uses two collections in the `kundportal` database:

### `customers` collection
- Contains all customer data
- Used for total customer count

### `users` collection
- Tracks user online status
- Fields: `lastSeen`, `isOnline`
- Users are considered online if `lastSeen` is within the last 5 minutes

## Frontend Updates

The dashboard automatically refreshes statistics every 30 seconds. The widgets show:
- "Laddar..." while fetching data
- "N/A" if there's an error
- Formatted numbers (e.g., "1,250") when data is available

## Environment Variables

Ensure `CUSTOMER_DB_URI` is set in your environment variables to connect to the customer portal database.
