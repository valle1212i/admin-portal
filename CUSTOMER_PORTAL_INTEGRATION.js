// CUSTOMER_PORTAL_INTEGRATION.js
// Add this script to your customer portal to track online users

// Configuration
const ADMIN_PORTAL_URL = 'https://admin-portal-rn5z.onrender.com';
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes
const LOGIN_TIMEOUT = 15 * 60 * 1000; // 15 minutes

class OnlineTracker {
  constructor() {
    this.userId = null;
    this.isTracking = false;
    this.heartbeatInterval = null;
    this.lastActivity = Date.now();
    
    // Initialize tracking when user is logged in
    this.init();
  }

  init() {
    // Check if user is logged in (adjust this based on your customer portal's auth system)
    const currentUser = this.getCurrentUser();
    
    if (currentUser && currentUser._id) {
      this.userId = currentUser._id;
      this.startTracking();
      console.log('🟢 Online tracking started for user:', currentUser.name || currentUser.email);
    } else {
      console.log('🔴 No user logged in, online tracking disabled');
    }
  }

  getCurrentUser() {
    // Adjust this method based on how your customer portal stores user data
    // Examples:
    
    // If using localStorage:
    // return JSON.parse(localStorage.getItem('user') || 'null');
    
    // If using sessionStorage:
    // return JSON.parse(sessionStorage.getItem('user') || 'null');
    
    // If using a global variable:
    // return window.currentUser || null;
    
    // If using cookies:
    // return this.getUserFromCookies();
    
    // Default implementation - adjust as needed:
    try {
      return JSON.parse(localStorage.getItem('customer') || sessionStorage.getItem('customer') || 'null');
    } catch (e) {
      return null;
    }
  }

  startTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    
    // Send initial login event
    this.updateOnlineStatus(true);
    
    // Start heartbeat to keep user online
    this.heartbeatInterval = setInterval(() => {
      this.updateOnlineStatus(true);
    }, HEARTBEAT_INTERVAL);
    
    // Track user activity to detect when they're active
    this.trackActivity();
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.updateOnlineStatus(true);
      }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.updateOnlineStatus(false);
    });
  }

  stopTracking() {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Send offline status
    this.updateOnlineStatus(false);
    
    console.log('🔴 Online tracking stopped');
  }

  trackActivity() {
    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      this.lastActivity = Date.now();
      // Optionally send activity update
      this.updateOnlineStatus(true);
    };
    
    // Throttle activity updates to avoid too many requests
    let activityTimeout;
    const throttledUpdate = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(updateActivity, 30000); // Max once per 30 seconds
    };
    
    events.forEach(event => {
      document.addEventListener(event, throttledUpdate, true);
    });
  }

  async updateOnlineStatus(isOnline) {
    if (!this.userId) return;
    
    try {
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/dashboard/user-online`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userId,
          isOnline: isOnline
        })
      });
      
      if (response.ok) {
        console.log(`📊 Online status updated: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      } else {
        console.error('❌ Failed to update online status:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Error updating online status:', error);
    }
  }

  // Public method to manually update status
  setOnline(isOnline) {
    this.updateOnlineStatus(isOnline);
  }
}

// Initialize the tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure user session is loaded
  setTimeout(() => {
    window.onlineTracker = new OnlineTracker();
  }, 1000);
});

// Export for manual initialization if needed
window.OnlineTracker = OnlineTracker;
