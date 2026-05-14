/**
 * Frontend API Client with Public and Authenticated Access
 * Handles both signed-in and anonymous users
 */

class HarmonestApiClient {
  constructor() {
    this.baseURL = 'https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod';
    this.isAuthenticated = false;
    this.userToken = null;
    this.userRole = null;
  }

  /**
   * Initialize authentication state
   */
  async initAuth() {
    try {
      // Try to get current authenticated user
      const user = await Auth.currentAuthenticatedUser();
      this.userToken = user.signInUserSession.idToken.jwtToken;
      this.userRole = this.extractUserRole(user);
      this.isAuthenticated = true;
      
      console.log(`Authenticated as: ${this.userRole}`);
    } catch (error) {
      // User not signed in - that's okay for public access
      this.isAuthenticated = false;
      console.log('Public access mode');
    }
  }

  /**
   * Extract user role from Cognito user object
   */
  extractUserRole(user) {
    const groups = user.signInUserSession.idToken.payload['cognito:groups'] || [];
    const roleHierarchy = { guest: 1, support: 2, admin: 3, super_admin: 4, owner: 5 };
    
    if (groups.length === 0) return 'guest';
    
    // Return highest role
    return groups.reduce((highest, current) => 
      roleHierarchy[current] > roleHierarchy[highest] ? current : highest
    );
  }

  /**
   * Make API request with optional authentication
   */
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth header if user is signed in
    if (this.isAuthenticated && this.userToken) {
      headers['Authorization'] = `Bearer ${this.userToken}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // ===== PUBLIC LISTINGS API =====

  /**
   * Get all listings (public access, enhanced for signed-in users)
   */
  async getListings() {
    const result = await this.request('/listings');
    
    if (result.success) {
      console.log(`Retrieved ${result.data.totalRooms} listings`);
      
      if (result.data.enhanced) {
        console.log(`Enhanced data available for ${result.data.userRole}`);
      }
    }
    
    return result;
  }

  /**
   * Get specific listing details
   */
  async getListing(listingId) {
    const result = await this.request(`/listings/${listingId}`);
    
    if (result.success) {
      const listing = result.data;
      console.log(`Retrieved listing: ${listing.title}`);
      
      // Log what additional data is available based on auth status
      if (listing.bookingInfo) {
        console.log('Booking info available (signed-in user)');
      }
      if (listing.operationalInfo) {
        console.log('Operational info available (support+)');
      }
      if (listing.managementInfo) {
        console.log('Management info available (admin+)');
      }
    }
    
    return result;
  }

  /**
   * Check availability for dates
   */
  async checkAvailability(listingId, checkIn, checkOut) {
    const result = await this.request(`/listings/${listingId}/availability`, {
      method: 'POST',
      body: JSON.stringify({ checkIn, checkOut })
    });
    
    if (result.success) {
      const availability = result.data;
      console.log(`Availability: ${availability.available ? 'Available' : 'Not available'}`);
      
      if (availability.memberDiscount) {
        console.log(`Member discount available: ${availability.memberDiscount.discountPercent}%`);
      }
    }
    
    return result;
  }

  // ===== AUTHENTICATED USER API =====

  /**
   * Get user profile (requires authentication)
   */
  async getUserProfile() {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for user profile');
    }
    
    return this.request('/profile');
  }

  /**
   * Get user's reservations (requires authentication)
   */
  async getUserReservations() {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for reservations');
    }
    
    return this.request('/profile/reservations');
  }

  // ===== ADMIN API (Protected) =====

  /**
   * Get all users (admin+ only)
   */
  async getUsers() {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required');
    }
    
    return this.request('/admin/users');
  }

  /**
   * Create new user (admin+ only)
   */
  async createUser(userData) {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required');
    }
    
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }
}

// ===== USAGE EXAMPLES =====

/**
 * Example: Public website (no authentication required)
 */
class PublicWebsite {
  constructor() {
    this.api = new HarmonestApiClient();
  }

  async init() {
    // Try to authenticate, but don't require it
    await this.api.initAuth();
    await this.loadListings();
  }

  async loadListings() {
    try {
      const result = await this.api.getListings();
      
      if (result.success) {
        this.displayListings(result.data);
        
        // Show enhanced features if user is signed in
        if (result.data.enhanced) {
          this.showEnhancedFeatures(result.data.userRole);
        }
      }
    } catch (error) {
      console.error('Error loading listings:', error);
    }
  }

  displayListings(data) {
    console.log(`Displaying ${data.totalRooms} listings`);
    // Render listings in UI
  }

  showEnhancedFeatures(userRole) {
    console.log(`Showing enhanced features for ${userRole}`);
    
    // Show different features based on role
    if (userRole === 'guest') {
      // Show member pricing, saved favorites, etc.
    } else if (userRole === 'support') {
      // Show support tools
    } else if (userRole === 'admin') {
      // Show admin controls
    }
  }
}

/**
 * Example: Guest portal (authentication required)
 */
class GuestPortal {
  constructor() {
    this.api = new HarmonestApiClient();
  }

  async init() {
    try {
      await this.api.initAuth();
      
      if (!this.api.isAuthenticated) {
        // Redirect to login
        window.location.href = '/login';
        return;
      }
      
      await this.loadUserData();
    } catch (error) {
      console.error('Authentication failed:', error);
      window.location.href = '/login';
    }
  }

  async loadUserData() {
    try {
      // Load user profile and reservations
      const [profile, reservations] = await Promise.all([
        this.api.getUserProfile(),
        this.api.getUserReservations()
      ]);
      
      this.displayUserDashboard(profile.data, reservations.data);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  displayUserDashboard(profile, reservations) {
    console.log(`Welcome ${profile.name}!`);
    console.log(`You have ${reservations.length} reservations`);
    // Render dashboard
  }
}

/**
 * Example: Admin dashboard (admin+ authentication required)
 */
class AdminDashboard {
  constructor() {
    this.api = new HarmonestApiClient();
  }

  async init() {
    await this.api.initAuth();
    
    if (!this.api.isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    
    // Check if user has admin privileges
    if (!['admin', 'super_admin', 'owner'].includes(this.api.userRole)) {
      alert('Access denied: Admin privileges required');
      window.location.href = '/';
      return;
    }
    
    await this.loadAdminData();
  }

  async loadAdminData() {
    try {
      const [users, listings] = await Promise.all([
        this.api.getUsers(),
        this.api.getListings() // Gets enhanced admin data
      ]);
      
      this.displayAdminDashboard(users.data, listings.data);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  }

  displayAdminDashboard(users, listings) {
    console.log(`Managing ${users.users.length} users`);
    console.log(`System info:`, listings.systemInfo);
    // Render admin dashboard
  }
}

// Export for use in your application
export { HarmonestApiClient, PublicWebsite, GuestPortal, AdminDashboard };
