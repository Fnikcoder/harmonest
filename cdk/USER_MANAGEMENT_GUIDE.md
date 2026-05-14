# Harmonest User Management System

## Overview

This document describes the role-based user management system for Harmonest, built with AWS Cognito and Lambda authorizers.

## User Roles & Permissions

### Role Hierarchy
```
OWNER (Level 5)
├── Full system access (same as super_admin)
├── User role management (can change user roles)
├── All AWS resources
└── System configuration

SUPER_ADMIN (Level 4)
├── DynamoDB full access
├── S3 full access
├── User management (create, read, update, delete users)
├── User role management (can change user roles)
└── System logs

ADMIN (Level 3)
├── NO user management access
├── DynamoDB read/write access
├── S3 read access
├── Reports and analytics
└── System logs

SUPPORT (Level 2)
├── Read-only access
├── Customer support tools
├── View logs
└── Basic reports

GUEST (Level 1)
├── Own data only
├── Check-in functionality
└── Profile management
```

## Deployment

### 1. Deploy the Stack
```bash
# Deploy user management stack
cdk deploy HarmonestUserManagement-prod --profile harmonestadmin

# Or for development
cdk deploy HarmonestUserManagement-dev --profile harmonestadmin
```

### 2. Create Initial Owner User
```bash
# Get the User Pool ID from CDK output
USER_POOL_ID="your-user-pool-id"

# Create owner user
aws cognito-idp admin-create-user \
    --profile harmonestadmin \
    --user-pool-id $USER_POOL_ID \
    --username "owner@harmonest.de" \
    --user-attributes Name=email,Value="owner@harmonest.de" Name=email_verified,Value=true \
    --temporary-password "TempPass123!" \
    --message-action SUPPRESS

# Add to owner group
aws cognito-idp admin-add-user-to-group \
    --profile harmonestadmin \
    --user-pool-id $USER_POOL_ID \
    --username "owner@harmonest.de" \
    --group-name "owner"
```

## API Endpoints

### Authentication
All protected endpoints require an `Authorization` header with a valid JWT token:
```
Authorization: Bearer <jwt-token>
```

### User Management API

**Base URL**: `https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod`

#### List Users
```http
GET /users
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of users to return (default: 50, max: 60)
- `nextToken` (optional): Pagination token

**Required Permission**: `users:read` (Super Admin+)

#### Get User Details
```http
GET /users/{userId}
Authorization: Bearer <token>
```

**Required Permission**: `users:read` (Super Admin+)

#### Create User
```http
POST /users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "temporaryPassword": "TempPass123!",
  "groups": ["guest"]
}
```

**Required Permission**: `users:write` (Super Admin+)

#### Update User Groups
```http
PUT /users/{userId}/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "groups": ["admin", "support"]
}
```

**Required Permission**: `users:change_roles` (Super Admin+)

#### Enable/Disable User
```http
PUT /users/{userId}/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": false
}
```

**Required Permission**: `users:write` (Super Admin+)

## Frontend Integration

### 1. Authentication Flow
```javascript
// Configure Amplify (or use Cognito SDK directly)
import { Amplify, Auth } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'eu-central-1',
    userPoolId: 'your-user-pool-id',
    userPoolWebClientId: 'your-client-id',
    oauth: {
      domain: 'your-cognito-domain.auth.eu-central-1.amazoncognito.com',
      scope: ['email', 'openid', 'profile'],
      redirectSignIn: 'https://harmonest.de/auth/callback',
      redirectSignOut: 'https://harmonest.de/auth/logout',
      responseType: 'code'
    }
  }
});

// Sign in
const signIn = async (email, password) => {
  try {
    const user = await Auth.signIn(email, password);
    return user;
  } catch (error) {
    console.error('Sign in error:', error);
  }
};

// Get current user and token
const getCurrentUser = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    const token = user.signInUserSession.idToken.jwtToken;
    const groups = user.signInUserSession.idToken.payload['cognito:groups'] || [];
    
    return { user, token, groups };
  } catch (error) {
    console.error('Get user error:', error);
  }
};
```

### 2. Making Authenticated API Calls
```javascript
// API client with authentication
class ApiClient {
  constructor() {
    this.baseURL = 'https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod';
  }

  async getAuthToken() {
    const user = await Auth.currentAuthenticatedUser();
    return user.signInUserSession.idToken.jwtToken;
  }

  async request(endpoint, options = {}) {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // User management methods
  async getUsers(limit = 50, nextToken = null) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    if (nextToken) params.append('nextToken', nextToken);
    
    return this.request(`/users?${params}`);
  }

  async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async updateUserGroups(userId, groups) {
    return this.request(`/users/${userId}/groups`, {
      method: 'PUT',
      body: JSON.stringify({ groups })
    });
  }
}
```

### 3. Role-Based UI Components
```javascript
// Role-based component wrapper
const RoleGuard = ({ requiredRole, userRole, children, fallback = null }) => {
  const roleHierarchy = {
    guest: 1,
    support: 2,
    admin: 3,
    super_admin: 4,
    owner: 5
  };

  const hasPermission = roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  
  return hasPermission ? children : fallback;
};

// Usage example
const AdminPanel = ({ userRole }) => (
  <div>
    <h1>Dashboard</h1>
    
    <RoleGuard requiredRole="support" userRole={userRole}>
      <SupportTools />
    </RoleGuard>
    
    <RoleGuard requiredRole="admin" userRole={userRole}>
      <UserManagement />
    </RoleGuard>
    
    <RoleGuard requiredRole="super_admin" userRole={userRole}>
      <SystemSettings />
    </RoleGuard>
    
    <RoleGuard requiredRole="owner" userRole={userRole}>
      <RoleManagement />
    </RoleGuard>
  </div>
);
```

## Backend Integration

### Using the Authorization System in Lambda Functions

```python
from authorizer import require_permission, get_user_context

@require_permission("dynamodb:read")
def get_admin_data(event, context):
    user_context = get_user_context(event)
    # Your function logic here
    return {"statusCode": 200, "body": "Success"}

# Or check permissions programmatically
def conditional_function(event, context):
    user_context = get_user_context(event)
    user_role = user_context['user_role']
    
    if user_role in ['super_admin', 'owner']:
        # Super Admin/Owner logic
        pass
    elif user_role == 'admin':
        # Admin logic (no user management)
        pass
    else:
        # Regular user logic
        pass
```

## Security Considerations

1. **Token Expiration**: Access tokens expire after 1 hour, refresh tokens after 30 days
2. **HTTPS Only**: All API calls must use HTTPS
3. **CORS**: Configured for harmonest.de domains only
4. **Rate Limiting**: Consider implementing rate limiting for production
5. **Audit Logging**: All user management actions are logged to CloudWatch

## Monitoring

### CloudWatch Metrics
- Lambda function invocations and errors
- Cognito sign-in attempts and failures
- API Gateway request counts and latencies

### CloudWatch Logs
- Authentication attempts
- Authorization decisions
- User management operations

## Troubleshooting

### Common Issues

1. **Token Expired**: Frontend should handle token refresh automatically
2. **Insufficient Permissions**: Check user groups and role assignments
3. **CORS Errors**: Ensure requests are from allowed origins

### Debug Commands
```bash
# Check user groups
aws cognito-idp admin-list-groups-for-user \
    --profile harmonestadmin \
    --user-pool-id $USER_POOL_ID \
    --username "user@example.com"

# View CloudWatch logs
aws logs describe-log-groups --profile harmonestadmin
aws logs get-log-events --profile harmonestadmin \
    --log-group-name "/aws/lambda/your-function-name" \
    --log-stream-name "latest-stream"
```
