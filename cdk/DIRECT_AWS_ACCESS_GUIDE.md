# Direct DynamoDB and S3 Access from Frontend

## Overview

Your frontend can now access DynamoDB and S3 directly using AWS SDK with automatic role-based permissions. No API Gateway needed - just direct, secure access based on user roles.

## Configuration Values

```env
# Add to your .env.local file
NEXT_PUBLIC_USER_POOL_ID=eu-central-1_oOMDUFanW
NEXT_PUBLIC_USER_POOL_CLIENT_ID=4jm7vgta4tc7r5chltr4eb4kqj
NEXT_PUBLIC_IDENTITY_POOL_ID=eu-central-1:434a4973-03f1-4074-929b-de185a7cd4ac
NEXT_PUBLIC_COGNITO_DOMAIN=harmonest-prod.auth.eu-central-1.amazoncognito.com
NEXT_PUBLIC_DYNAMODB_TABLE=harmonest-main
NEXT_PUBLIC_S3_BUCKET=harmonest-storage
NEXT_PUBLIC_AWS_REGION=eu-central-1
NEXT_PUBLIC_REDIRECT_SIGN_IN=https://harmonest.de/auth/callback
NEXT_PUBLIC_REDIRECT_SIGN_OUT=https://harmonest.de/auth/logout
NEXT_PUBLIC_USER_MANAGEMENT_API=https://8y8k22wgzj.execute-api.eu-central-1.amazonaws.com/prod
```

## How It Works

1. **User logs in** → Gets Cognito User Pool token with their groups (owner, admin, support, guest)
2. **Frontend exchanges token** → Cognito Identity Pool gives AWS credentials with the right IAM role
3. **Frontend uses AWS SDK directly** → Direct access to DynamoDB and S3 with automatic permissions

## Setup

### Install Dependencies
```bash
npm install aws-amplify aws-sdk
```

### Configure Amplify
```javascript
// config/aws-config.js
import { Amplify } from 'aws-amplify';

const awsConfig = {
  Auth: {
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
    userPoolWebClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
    identityPoolId: process.env.NEXT_PUBLIC_IDENTITY_POOL_ID,
    oauth: {
      domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
      scope: ['email', 'openid', 'profile'],
      redirectSignIn: process.env.NEXT_PUBLIC_REDIRECT_SIGN_IN,
      redirectSignOut: process.env.NEXT_PUBLIC_REDIRECT_SIGN_OUT,
      responseType: 'code'
    }
  },
  Storage: {
    AWSS3: {
      bucket: process.env.NEXT_PUBLIC_S3_BUCKET,
      region: process.env.NEXT_PUBLIC_AWS_REGION
    }
  }
};

Amplify.configure(awsConfig);
export default awsConfig;
```

### Authentication Context
```javascript
// contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth } from 'aws-amplify';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const rolePermissions = {
    owner: [
      'users:read', 'users:write', 'users:delete', 'users:change_roles',
      'dynamodb:read', 'dynamodb:write', 'dynamodb:delete',
      's3:read', 's3:write', 's3:delete',
      'reservations:read', 'reservations:write', 'reservations:delete',
      'listings:read', 'listings:write', 'listings:delete',
      'files:read', 'files:write', 'files:delete'
    ],
    super_admin: [
      'users:read', 'users:write', 'users:delete', 'users:change_roles',
      'dynamodb:read', 'dynamodb:write', 'dynamodb:delete',
      's3:read', 's3:write', 's3:delete',
      'reservations:read', 'reservations:write', 'reservations:delete',
      'listings:read', 'listings:write', 'listings:delete',
      'files:read', 'files:write', 'files:delete'
    ],
    admin: [
      'dynamodb:read', 'dynamodb:write',
      's3:read',
      'reservations:read', 'reservations:write',
      'listings:read', 'listings:write',
      'files:read', 'files:write'
    ],
    support: [
      'dynamodb:read',
      's3:read',
      'reservations:read',
      'listings:read',
      'files:read'
    ],
    guest: [
      'profile:read', 'profile:write',
      'reservations:read_own',
      'files:read_own', 'files:write_own'
    ]
  };

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      const groups = currentUser.signInUserSession.idToken.payload['cognito:groups'] || [];
      const primaryRole = groups[0] || 'guest';

      setUser(currentUser);
      setUserRole(primaryRole);
      setPermissions(rolePermissions[primaryRole] || []);
    } catch (error) {
      console.log('No authenticated user');
      setUser(null);
      setUserRole(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      const user = await Auth.signIn(email, password);
      await checkAuthState();
      return user;
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await Auth.signOut();
      setUser(null);
      setUserRole(null);
      setPermissions([]);
    } catch (error) {
      throw error;
    }
  };

  const hasPermission = (permission) => {
    return permissions.includes(permission);
  };

  const getAuthToken = async () => {
    if (!user) return null;
    return user.signInUserSession.idToken.jwtToken;
  };

  const getUserId = () => {
    return user?.username || null;
  };

  const getUserEmail = () => {
    return user?.attributes?.email || null;
  };

  const value = {
    user,
    userRole,
    permissions,
    loading,
    signIn,
    signOut,
    hasPermission,
    getAuthToken,
    getUserId,
    getUserEmail,
    checkAuthState
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

## DynamoDB Access

```javascript
// services/dynamoService.js
import { Auth } from 'aws-amplify';
import AWS from 'aws-sdk';

class DynamoService {
  constructor() {
    this.tableName = process.env.NEXT_PUBLIC_DYNAMODB_TABLE;
    this.dynamodb = null;
  }

  async initializeClient() {
    if (this.dynamodb) return this.dynamodb;

    const credentials = await Auth.currentCredentials();
    AWS.config.update({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
      credentials: credentials
    });

    this.dynamodb = new AWS.DynamoDB.DocumentClient();
    return this.dynamodb;
  }

  async getItem(pk, sk) {
    const client = await this.initializeClient();
    const result = await client.get({
      TableName: this.tableName,
      Key: { PK: pk, SK: sk }
    }).promise();
    return result.Item;
  }

  async queryItems(pk, options = {}) {
    const client = await this.initializeClient();
    const result = await client.query({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      ...options
    }).promise();
    return result.Items;
  }

  async putItem(item) {
    const client = await this.initializeClient();
    await client.put({
      TableName: this.tableName,
      Item: { ...item, updatedAt: Date.now() }
    }).promise();
    return item;
  }

  async updateItem(pk, sk, updates) {
    const client = await this.initializeClient();
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(updates).forEach(key => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = updates[key];
    });

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = Date.now();

    const result = await client.update({
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }).promise();
    return result.Attributes;
  }

  async deleteItem(pk, sk) {
    const client = await this.initializeClient();
    await client.delete({
      TableName: this.tableName,
      Key: { PK: pk, SK: sk }
    }).promise();
    return true;
  }
}

export default new DynamoService();
```

## S3 Access

```javascript
// services/s3Service.js
import { Storage } from 'aws-amplify';

class S3Service {
  async uploadFile(key, file, options = {}) {
    const result = await Storage.put(key, file, {
      level: 'protected', // Uses cognito identity for path
      contentType: file.type,
      ...options
    });
    return result;
  }

  async downloadFile(key, options = {}) {
    const url = await Storage.get(key, {
      level: 'protected',
      expires: 3600, // 1 hour
      ...options
    });
    return url;
  }

  async listFiles(prefix = '', options = {}) {
    const result = await Storage.list(prefix, {
      level: 'protected',
      ...options
    });
    return result;
  }

  async deleteFile(key, options = {}) {
    await Storage.remove(key, {
      level: 'protected',
      ...options
    });
    return true;
  }

  // ID Card specific methods
  async uploadIdCard(reservationId, guestId, file) {
    const key = `id-cards/${reservationId}/${guestId}/${file.name}`;
    return this.uploadFile(key, file);
  }

  async getIdCard(reservationId, guestId, filename) {
    const key = `id-cards/${reservationId}/${guestId}/${filename}`;
    return this.downloadFile(key);
  }

  async listIdCards(reservationId, guestId = null) {
    const prefix = guestId 
      ? `id-cards/${reservationId}/${guestId}/`
      : `id-cards/${reservationId}/`;
    return this.listFiles(prefix);
  }
}

export default new S3Service();
```

## App Setup

### Main App Component
```javascript
// App.js or _app.js (Next.js)
import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import './config/aws-config'; // Import to configure Amplify

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Navigation />
        <main>
          <Dashboard />
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;
```

### Permission Guard Component
```javascript
// components/PermissionGuard.js
import { useAuth } from '../contexts/AuthContext';

const PermissionGuard = ({
  permission,
  role,
  children,
  fallback = null,
  showError = false
}) => {
  const { hasPermission, userRole } = useAuth();

  // Check by permission
  if (permission && !hasPermission(permission)) {
    return showError ? (
      <div className="error">Insufficient permissions</div>
    ) : fallback;
  }

  // Check by role hierarchy
  if (role) {
    const roleHierarchy = {
      guest: 1,
      support: 2,
      admin: 3,
      super_admin: 4,
      owner: 5
    };

    const hasRoleAccess = roleHierarchy[userRole] >= roleHierarchy[role];
    if (!hasRoleAccess) {
      return showError ? (
        <div className="error">Insufficient role level</div>
      ) : fallback;
    }
  }

  return children;
};

export default PermissionGuard;
```

### Navigation Component
```javascript
// components/Navigation.js
import { useAuth } from '../contexts/AuthContext';
import PermissionGuard from './PermissionGuard';

const Navigation = () => {
  const { user, userRole, signOut } = useAuth();

  if (!user) {
    return <LoginForm />;
  }

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <h1>Harmonest</h1>
        <span className="user-info">
          {user.attributes.email} ({userRole})
        </span>
      </div>

      <ul className="nav-links">
        <li><a href="/dashboard">Dashboard</a></li>

        <PermissionGuard permission="reservations:read">
          <li><a href="/reservations">Reservations</a></li>
        </PermissionGuard>

        <PermissionGuard permission="listings:read">
          <li><a href="/listings">Listings</a></li>
        </PermissionGuard>

        <PermissionGuard permission="files:read">
          <li><a href="/id-cards">ID Cards</a></li>
        </PermissionGuard>

        <PermissionGuard permission="users:read">
          <li><a href="/users">User Management</a></li>
        </PermissionGuard>
      </ul>

      <button onClick={signOut} className="sign-out-btn">
        Sign Out
      </button>
    </nav>
  );
};

const LoginForm = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      alert('Login failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Sign In</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
};

export default Navigation;
```

## Usage Examples

### Get Listings
```javascript
import dynamoService from './services/dynamoService';

// Get all listings (permissions enforced automatically)
const listings = await dynamoService.queryItems('LISTING#');

// Get specific listing
const listing = await dynamoService.getItem('LISTING#123', 'META');
```

### Get Reservations
```javascript
// Get all reservations
const reservations = await dynamoService.queryItems('RESERVATION#');

// Get reservations for specific listing
const listingReservations = await dynamoService.scanItems(
  'listingId = :listingId AND begins_with(PK, :pk)',
  { ':listingId': 'listing123', ':pk': 'RESERVATION#' }
);
```

### Upload ID Card
```javascript
import s3Service from './services/s3Service';

// Upload ID card for guest
const result = await s3Service.uploadIdCard('reservation123', 'guest456', file);

// List ID cards for reservation
const cards = await s3Service.listIdCards('reservation123');

// Download ID card
const url = await s3Service.getIdCard('reservation123', 'guest456', 'passport.jpg');
```

## Role-Based Permissions (Automatic)

| Role | DynamoDB Access | S3 Access |
|------|----------------|-----------|
| **Owner/Super Admin** | Full access to all data | Full access to all files |
| **Admin** | Read/write business data (LISTING#, RESERVATION#) | Read all, write to protected/ |
| **Support** | Read-only business data | Read public/ only |
| **Guest** | Own data only (USER#{their-id}) | Own private folder only |

## Data Structure

### DynamoDB Table: `harmonest-main`
```
LISTING#{id} / META                     # Listing metadata
LISTING#{id} / DOOR#{door_id}           # Listing doors
RESERVATION#{id} / META                 # Reservation metadata  
RESERVATION#{id} / GUEST#{guest_id}     # Reservation guests
USER#{user_id} / META                   # User profiles
```

### S3 Bucket: `harmonest-storage`
```
public/                                 # Public files (all can read)
protected/                              # Protected files (admin+ write, all read)
private/{cognito-id}/                   # Private user files (own access only)
id-cards/{reservation_id}/{guest_id}/   # ID card files
```

## Error Handling

```javascript
try {
  const listings = await dynamoService.queryItems('LISTING#');
} catch (error) {
  if (error.code === 'AccessDeniedException') {
    console.log('User does not have permission to access this data');
  } else {
    console.error('Error:', error.message);
  }
}
```

## Benefits

✅ **Better Performance** - Direct AWS SDK calls, no API Gateway latency  
✅ **Cost Effective** - No Lambda execution costs for data operations  
✅ **Secure** - IAM policies enforce fine-grained permissions automatically  
✅ **Real-time** - No additional layers or cold starts  
✅ **Scalable** - AWS SDK handles connection pooling  

## Testing

Create users in different Cognito groups and test:
- Owner/Super Admin can access everything
- Admin can access business data but not user data
- Support can only read business data
- Guest can only access their own data

The IAM policies automatically enforce these permissions - no additional code needed!

## Troubleshooting

### Access Denied Errors

If you get `AccessDeniedException` errors even though the user is in the correct Cognito group:

1. **Clear cached credentials** - Add this function to force refresh:
```javascript
// utils/authUtils.js
import { Auth } from 'aws-amplify';

export const clearCachedCredentials = async () => {
  try {
    // Clear Amplify cache
    await Auth.signOut({ global: true });

    // Clear browser storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear AWS SDK cache
    if (window.AWS) {
      window.AWS.config.credentials = null;
    }

    console.log('Cached credentials cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

export const forceCredentialRefresh = async () => {
  try {
    // Get fresh credentials from Identity Pool
    const credentials = await Auth.currentCredentials();
    await credentials.refresh();
    console.log('Credentials refreshed');
    return credentials;
  } catch (error) {
    console.error('Error refreshing credentials:', error);
    throw error;
  }
};
```

2. **Add refresh button to your app**:
```javascript
// components/DebugPanel.js
import { clearCachedCredentials, forceCredentialRefresh } from '../utils/authUtils';

const DebugPanel = () => {
  const { user, userRole, checkAuthState } = useAuth();

  const handleClearCache = async () => {
    await clearCachedCredentials();
    window.location.reload(); // Force page reload
  };

  const handleRefreshCredentials = async () => {
    try {
      await forceCredentialRefresh();
      await checkAuthState(); // Refresh auth state
      alert('Credentials refreshed successfully');
    } catch (error) {
      alert('Failed to refresh credentials: ' + error.message);
    }
  };

  return (
    <div className="debug-panel">
      <h3>Debug Panel</h3>
      <p>User: {user?.attributes?.email}</p>
      <p>Role: {userRole}</p>
      <p>Groups: {user?.signInUserSession?.idToken?.payload['cognito:groups']?.join(', ')}</p>

      <button onClick={handleRefreshCredentials}>
        Refresh Credentials
      </button>
      <button onClick={handleClearCache}>
        Clear Cache & Sign Out
      </button>
    </div>
  );
};
```

3. **Check user groups in token**:
```javascript
// Add this to your auth context or debug panel
const checkUserGroups = () => {
  if (user?.signInUserSession?.idToken?.payload) {
    const groups = user.signInUserSession.idToken.payload['cognito:groups'] || [];
    console.log('User groups in token:', groups);
    return groups;
  }
  return [];
};
```

### Common Issues

1. **User shows correct group but gets wrong role**:
   - Clear browser cache and localStorage
   - Sign out and sign back in
   - Use the credential refresh function

2. **Role mappings not working**:
   - Verify user is in correct Cognito group
   - Check that group name matches exactly in role mapping rules
   - Ensure user has signed out and back in after group assignment

3. **Still getting GuestRole**:
   - The user token might be cached - force a complete sign out
   - Clear all browser storage
   - Sign back in to get fresh token with correct groups

### Debug Commands

Check if role mappings are configured:
```bash
aws cognito-identity get-identity-pool-roles --identity-pool-id "eu-central-1:434a4973-03f1-4074-929b-de185a7cd4ac" --profile harmonestadmin
```

Check user's groups:
```bash
aws cognito-idp admin-list-groups-for-user --user-pool-id "eu-central-1_oOMDUFanW" --username "user@example.com" --profile harmonestadmin
```
