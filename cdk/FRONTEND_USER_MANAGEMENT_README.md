# Frontend User Management Integration Guide

## Overview

This guide explains how to integrate your frontend application with the Harmonest User Management System to access DynamoDB, S3, and Cognito resources **directly** based on user roles and permissions using Cognito Identity Pool.

## Architecture

```
Frontend App
    ↓ (Cognito User Pool Token)
Cognito Identity Pool
    ↓ (Assumes IAM Role based on user group)
IAM Role with Policies
    ↓ (Direct access with AWS SDK)
DynamoDB / S3
```

## Prerequisites

- User Management Stack deployed (see `USER_MANAGEMENT_GUIDE.md`)
- Identity Pool Stack deployed for direct AWS access
- Valid Cognito User Pool, App Client, and Identity Pool configured

## Quick Start

### 1. Install Dependencies

```bash
# For React/Next.js applications with direct AWS access
npm install aws-amplify @aws-amplify/auth @aws-amplify/storage aws-sdk

# Alternative: Using AWS SDK v3 (recommended for new projects)
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-s3 @aws-sdk/credential-providers aws-amplify
```

### 2. Configure Authentication with Identity Pool

```javascript
// aws-config.js
import { Amplify } from 'aws-amplify';

const awsConfig = {
  Auth: {
    region: 'eu-central-1',
    userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
    userPoolWebClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
    identityPoolId: process.env.NEXT_PUBLIC_IDENTITY_POOL_ID, // NEW: For direct AWS access
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
      region: 'eu-central-1'
    }
  }
};

Amplify.configure(awsConfig);
export default awsConfig;
```

### 3. Environment Variables

Create `.env.local` file:

```env
# Cognito Configuration
NEXT_PUBLIC_USER_POOL_ID=eu-central-1_xxxxxxxxx
NEXT_PUBLIC_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_IDENTITY_POOL_ID=eu-central-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain.auth.eu-central-1.amazoncognito.com

# AWS Resources (for direct access)
NEXT_PUBLIC_S3_BUCKET=your-s3-bucket-name
NEXT_PUBLIC_DYNAMODB_TABLE=harmonest-prod-main

# OAuth Redirects
NEXT_PUBLIC_REDIRECT_SIGN_IN=https://harmonest.de/auth/callback
NEXT_PUBLIC_REDIRECT_SIGN_OUT=https://harmonest.de/auth/logout

# Optional: User Management API (for admin functions)
NEXT_PUBLIC_USER_MANAGEMENT_API=https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod
```

## Direct AWS Access Services

### 1. DynamoDB Service

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

    // Get AWS credentials from Cognito Identity Pool
    const credentials = await Auth.currentCredentials();

    AWS.config.update({
      region: 'eu-central-1',
      credentials: credentials
    });

    this.dynamodb = new AWS.DynamoDB.DocumentClient();
    return this.dynamodb;
  }

  async getItem(pk, sk) {
    const client = await this.initializeClient();

    const params = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk }
    };

    try {
      const result = await client.get(params).promise();
      return result.Item;
    } catch (error) {
      console.error('DynamoDB get error:', error);
      throw error;
    }
  }

  async putItem(item) {
    const client = await this.initializeClient();

    const params = {
      TableName: this.tableName,
      Item: {
        ...item,
        updatedAt: Date.now()
      }
    };

    try {
      await client.put(params).promise();
      return item;
    } catch (error) {
      console.error('DynamoDB put error:', error);
      throw error;
    }
  }

  async queryItems(pk, options = {}) {
    const client = await this.initializeClient();

    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': pk
      },
      ...options
    };

    try {
      const result = await client.query(params).promise();
      return result.Items;
    } catch (error) {
      console.error('DynamoDB query error:', error);
      throw error;
    }
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

    // Add updatedAt
    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = Date.now();

    const params = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    try {
      const result = await client.update(params).promise();
      return result.Attributes;
    } catch (error) {
      console.error('DynamoDB update error:', error);
      throw error;
    }
  }

  async deleteItem(pk, sk) {
    const client = await this.initializeClient();

    const params = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk }
    };

    try {
      await client.delete(params).promise();
      return true;
    } catch (error) {
      console.error('DynamoDB delete error:', error);
      throw error;
    }
  }
}

export default new DynamoService();
```

### 2. S3 Service

```javascript
// services/s3Service.js
import { Storage } from 'aws-amplify';

class S3Service {
  async uploadFile(key, file, options = {}) {
    try {
      const result = await Storage.put(key, file, {
        level: 'protected', // Uses cognito identity for path
        contentType: file.type,
        ...options
      });
      return result;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }

  async downloadFile(key, options = {}) {
    try {
      const url = await Storage.get(key, {
        level: 'protected',
        expires: 3600, // 1 hour
        ...options
      });
      return url;
    } catch (error) {
      console.error('S3 download error:', error);
      throw error;
    }
  }

  async listFiles(prefix = '', options = {}) {
    try {
      const result = await Storage.list(prefix, {
        level: 'protected',
        ...options
      });
      return result;
    } catch (error) {
      console.error('S3 list error:', error);
      throw error;
    }
  }

  async deleteFile(key, options = {}) {
    try {
      await Storage.remove(key, {
        level: 'protected',
        ...options
      });
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      throw error;
    }
  }

  // Role-based access levels
  async uploadToPublic(key, file) {
    return this.uploadFile(key, file, { level: 'public' });
  }

  async uploadToPrivate(key, file) {
    return this.uploadFile(key, file, { level: 'private' });
  }
}

export default new S3Service();
```

## Authentication Implementation

### 1. Auth Context Provider

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
    owner: ['users:read', 'users:write', 'users:change_roles', 'dynamodb:read', 'dynamodb:write', 's3:read', 's3:write'],
    super_admin: ['users:read', 'users:write', 'users:change_roles', 'dynamodb:read', 'dynamodb:write', 's3:read', 's3:write'],
    admin: ['dynamodb:read', 'dynamodb:write', 's3:read'],
    support: ['dynamodb:read', 's3:read'],
    guest: ['profile:read', 'profile:write']
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

  const value = {
    user,
    userRole,
    permissions,
    loading,
    signIn,
    signOut,
    hasPermission,
    getAuthToken,
    checkAuthState
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 2. API Client for Backend Communication

```javascript
// services/apiClient.js
import { useAuth } from '../contexts/AuthContext';

class ApiClient {
  constructor(getAuthToken) {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;
    this.getAuthToken = getAuthToken;
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
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // User Management
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

  async updateUserStatus(userId, enabled) {
    return this.request(`/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
  }

  // DynamoDB Operations (through your API)
  async getDynamoItem(pk, sk) {
    return this.request('/dynamodb/get', {
      method: 'POST',
      body: JSON.stringify({ pk, sk })
    });
  }

  async queryDynamoItems(pk, options = {}) {
    return this.request('/dynamodb/query', {
      method: 'POST',
      body: JSON.stringify({ pk, ...options })
    });
  }

  async putDynamoItem(item) {
    return this.request('/dynamodb/put', {
      method: 'POST',
      body: JSON.stringify({ item })
    });
  }

  async updateDynamoItem(pk, sk, updates) {
    return this.request('/dynamodb/update', {
      method: 'POST',
      body: JSON.stringify({ pk, sk, updates })
    });
  }

  async deleteDynamoItem(pk, sk) {
    return this.request('/dynamodb/delete', {
      method: 'POST',
      body: JSON.stringify({ pk, sk })
    });
  }

  // S3 Operations (through your API)
  async getS3DownloadUrl(key, expiresIn = 3600) {
    return this.request('/s3/download', {
      method: 'POST',
      body: JSON.stringify({ key, expires_in: expiresIn })
    });
  }

  async getS3UploadUrl(key, contentType, expiresIn = 3600) {
    return this.request('/s3/upload-url', {
      method: 'POST',
      body: JSON.stringify({ key, content_type: contentType, expires_in: expiresIn })
    });
  }

  async uploadS3File(key, fileContent, contentType) {
    return this.request('/s3/upload', {
      method: 'POST',
      body: JSON.stringify({ key, file_content: fileContent, content_type: contentType })
    });
  }

  async listS3Files(prefix = '', maxKeys = 100, continuationToken = null) {
    const params = new URLSearchParams();
    if (prefix) params.append('prefix', prefix);
    if (maxKeys) params.append('max_keys', maxKeys);
    if (continuationToken) params.append('continuation_token', continuationToken);

    return this.request(`/s3/list?${params}`);
  }

  async deleteS3File(key) {
    return this.request('/s3/delete', {
      method: 'POST',
      body: JSON.stringify({ key })
    });
  }

  // Custom endpoints for your business logic
  async getListings() {
    return this.request('/listings');
  }

  async updateListing(listingId, data) {
    return this.request(`/listings/${listingId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}

// Hook to use API client
export const useApiClient = () => {
  const { getAuthToken } = useAuth();
  return new ApiClient(getAuthToken);
};
```

## Role-Based Access Control

### 1. Permission Guard Component

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

### 2. Usage Examples

```javascript
// pages/dashboard.js
import { useAuth } from '../contexts/AuthContext';
import { useApiClient } from '../services/apiClient';
import PermissionGuard from '../components/PermissionGuard';

const Dashboard = () => {
  const { userRole, hasPermission } = useAuth();
  const apiClient = useApiClient();

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Show different content based on permissions */}
      <PermissionGuard permission="dynamodb:read">
        <DataViewer />
      </PermissionGuard>

      <PermissionGuard role="admin">
        <AdminTools />
      </PermissionGuard>

      <PermissionGuard role="super_admin">
        <UserManagement />
      </PermissionGuard>

      <PermissionGuard role="owner">
        <SystemSettings />
      </PermissionGuard>
    </div>
  );
};

// Example: Direct DynamoDB Access Component
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import dynamoService from '../services/dynamoService';

const DataViewer = () => {
  const { user, userRole } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadListings = async () => {
    setLoading(true);
    try {
      // Direct DynamoDB access - permissions enforced by IAM
      const listingData = await dynamoService.queryItems('LISTING#', {
        ScanIndexForward: false,
        Limit: 50
      });
      setListings(listingData);
    } catch (error) {
      console.error('Failed to load listings:', error);
      // Handle permission errors gracefully
      if (error.code === 'AccessDeniedException') {
        alert('You do not have permission to view listings');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateListing = async (listingId, updates) => {
    try {
      // Direct DynamoDB update - permissions enforced by IAM
      await dynamoService.updateItem(`LISTING#${listingId}`, 'META', updates);
      // Reload listings
      loadListings();
    } catch (error) {
      console.error('Failed to update listing:', error);
      if (error.code === 'AccessDeniedException') {
        alert('You do not have permission to update listings');
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadListings();
    }
  }, [user]);

  return (
    <div>
      <h2>Listings - Role: {userRole}</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {listings.map(listing => (
            <li key={listing.PK}>
              {listing.name || listing.PK}
              {/* Show update button for admin+ roles */}
              {['admin', 'super_admin', 'owner'].includes(userRole) && (
                <button onClick={() => updateListing(listing.id, { status: 'updated' })}>
                  Update
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Example: Direct S3 Access Component
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import s3Service from '../services/s3Service';

const FileManager = () => {
  const { user, userRole } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadFiles = async () => {
    try {
      // Direct S3 access - permissions enforced by IAM
      const fileData = await s3Service.listFiles();
      setFiles(fileData);
    } catch (error) {
      console.error('Failed to load files:', error);
      if (error.code === 'AccessDenied') {
        alert('You do not have permission to list files');
      }
    }
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    try {
      // Determine upload level based on user role
      const getUploadLevel = () => {
        switch (userRole) {
          case 'owner':
          case 'super_admin':
            return 'public'; // Can upload to public
          case 'admin':
            return 'protected'; // Can upload to protected
          default:
            return 'private'; // Can only upload to own private folder
        }
      };

      const key = `uploads/${Date.now()}_${file.name}`;
      const level = getUploadLevel();

      // Direct S3 upload - permissions enforced by IAM
      await s3Service.uploadFile(key, file, { level });

      alert('File uploaded successfully!');
      loadFiles(); // Refresh file list
    } catch (error) {
      console.error('Upload failed:', error);
      if (error.code === 'AccessDenied') {
        alert('You do not have permission to upload files to this location');
      } else {
        alert('Upload failed: ' + error.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileDownload = async (key) => {
    try {
      // Direct S3 download - permissions enforced by IAM
      const url = await s3Service.downloadFile(key);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download failed:', error);
      if (error.code === 'AccessDenied') {
        alert('You do not have permission to download this file');
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [user]);

  return (
    <div>
      <h3>File Manager - Role: {userRole}</h3>

      {/* Upload Section */}
      {['admin', 'super_admin', 'owner'].includes(userRole) && (
        <div>
          <input
            type="file"
            onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
            disabled={uploading}
          />
          {uploading && <p>Uploading...</p>}
        </div>
      )}

      {/* File List */}
      <div>
        <h4>Files</h4>
        <ul>
          {files.map(file => (
            <li key={file.key}>
              {file.key}
              <button onClick={() => handleFileDownload(file.key)}>
                Download
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
```

## S3 File Operations

### 1. S3 Service with Role-Based Access

```javascript
// services/s3Service.js
import { Storage } from 'aws-amplify';
import { useAuth } from '../contexts/AuthContext';

export const useS3Service = () => {
  const { hasPermission, userRole } = useAuth();

  const uploadFile = async (file, key, options = {}) => {
    if (!hasPermission('s3:write')) {
      throw new Error('No permission to upload files');
    }

    try {
      const result = await Storage.put(key, file, {
        level: getRoleBasedLevel(),
        ...options
      });
      return result;
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  };

  const downloadFile = async (key) => {
    if (!hasPermission('s3:read')) {
      throw new Error('No permission to download files');
    }

    try {
      const url = await Storage.get(key, {
        level: getRoleBasedLevel(),
        expires: 3600 // 1 hour
      });
      return url;
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  };

  const listFiles = async (prefix = '') => {
    if (!hasPermission('s3:read')) {
      throw new Error('No permission to list files');
    }

    try {
      const result = await Storage.list(prefix, {
        level: getRoleBasedLevel()
      });
      return result;
    } catch (error) {
      throw new Error(`List failed: ${error.message}`);
    }
  };

  const getRoleBasedLevel = () => {
    // Define access levels based on user role
    switch (userRole) {
      case 'owner':
      case 'super_admin':
        return 'protected'; // Can access all user files
      case 'admin':
      case 'support':
        return 'public'; // Can access public files only
      default:
        return 'private'; // Can access own files only
    }
  };

  return {
    uploadFile,
    downloadFile,
    listFiles,
    canUpload: hasPermission('s3:write'),
    canDownload: hasPermission('s3:read')
  };
};
```

## Error Handling

### 1. Global Error Handler

```javascript
// utils/errorHandler.js
export const handleApiError = (error) => {
  if (error.message.includes('401') || error.message.includes('Unauthorized')) {
    // Token expired or invalid
    window.location.href = '/login';
    return;
  }

  if (error.message.includes('403') || error.message.includes('Forbidden')) {
    // Insufficient permissions
    return 'You do not have permission to perform this action';
  }

  if (error.message.includes('404')) {
    return 'Resource not found';
  }

  return error.message || 'An unexpected error occurred';
};
```

## Role-Based Access Control

### Permission Matrix

| Role | DynamoDB | S3 | User Management |
|------|----------|----|-----------------|
| **Owner** | Full access | Full access | Full access |
| **Super Admin** | Full access | Full access | Full access |
| **Admin** | Read/Write business data | Read public/protected, Write protected | No access |
| **Support** | Read-only business data | Read public only | No access |
| **Guest** | Own data only | Own private folder only | Own profile only |

### Data Access Patterns

```javascript
// DynamoDB Access Patterns by Role

// OWNER/SUPER_ADMIN: Can access all data
await dynamoService.queryItems('LISTING#'); // ✅ Allowed
await dynamoService.queryItems('USER#'); // ✅ Allowed
await dynamoService.putItem({PK: 'ADMIN#config', SK: 'META'}); // ✅ Allowed

// ADMIN: Can access business data, not user management
await dynamoService.queryItems('LISTING#'); // ✅ Allowed
await dynamoService.queryItems('RESERVATION#'); // ✅ Allowed
await dynamoService.queryItems('USER#'); // ❌ Access Denied

// SUPPORT: Read-only business data
await dynamoService.queryItems('LISTING#'); // ✅ Allowed
await dynamoService.putItem({PK: 'LISTING#123', SK: 'META'}); // ❌ Access Denied

// GUEST: Own data only
await dynamoService.queryItems('USER#their-cognito-id'); // ✅ Allowed
await dynamoService.queryItems('LISTING#'); // ❌ Access Denied
```

```javascript
// S3 Access Patterns by Role

// OWNER/SUPER_ADMIN: Full access
await s3Service.uploadFile('admin/config.json', file); // ✅ Allowed
await s3Service.uploadFile('public/image.jpg', file); // ✅ Allowed

// ADMIN: Read all, write to protected
await s3Service.downloadFile('public/image.jpg'); // ✅ Allowed
await s3Service.uploadFile('protected/doc.pdf', file); // ✅ Allowed
await s3Service.uploadFile('admin/config.json', file); // ❌ Access Denied

// SUPPORT: Read public only
await s3Service.downloadFile('public/image.jpg'); // ✅ Allowed
await s3Service.downloadFile('protected/doc.pdf'); // ❌ Access Denied

// GUEST: Own private folder only
await s3Service.uploadFile('private/their-id/file.pdf', file); // ✅ Allowed
await s3Service.downloadFile('public/image.jpg'); // ❌ Access Denied
```

## Benefits of Direct Access

✅ **Better Performance**: No API Gateway latency
✅ **Cost Effective**: No Lambda execution costs for data operations
✅ **Real-time**: Direct AWS SDK calls
✅ **Scalable**: Leverages AWS SDK connection pooling
✅ **Secure**: IAM policies enforce fine-grained permissions
✅ **Offline Support**: AWS SDK handles retries and offline scenarios
✅ **Automatic Scaling**: No cold start issues

## Deployment Instructions

### 1. Deploy the Identity Pool Stack

```bash
# Deploy the identity pool stack
cdk deploy --context client=harmonest --context env=prod HarmonestIdentityPool-prod --profile harmonestadmin

# Or for development
cdk deploy --context client=harmonest --context env=dev HarmonestIdentityPool-dev --profile harmonestadmin
```

### 2. Get Configuration Values

After deployment, get the configuration values from AWS Systems Manager:

```bash
# Get Identity Pool ID
aws ssm get-parameter --name "/harmonest/prod/cognito/identity-pool-id" --query "Parameter.Value" --output text

# Get User Pool ID
aws ssm get-parameter --name "/harmonest/prod/cognito/user-pool-id" --query "Parameter.Value" --output text

# Get User Pool Client ID
aws ssm get-parameter --name "/harmonest/prod/cognito/user-pool-client-id" --query "Parameter.Value" --output text
```

### 3. Update Frontend Environment

Update your `.env.local` with the actual values:

```env
NEXT_PUBLIC_IDENTITY_POOL_ID=eu-central-1:12345678-1234-1234-1234-123456789012
NEXT_PUBLIC_USER_POOL_ID=eu-central-1_AbCdEfGhI
NEXT_PUBLIC_USER_POOL_CLIENT_ID=1234567890abcdefghijklmnop
```

## Testing Your Integration

### 1. Test Different User Roles

Create test users with different roles and verify access:

```javascript
// Test script to verify role-based access
const testRoleAccess = async () => {
  const { user, userRole } = useAuth();

  console.log(`Testing access for role: ${userRole}`);

  try {
    // Test DynamoDB access
    const listings = await dynamoService.queryItems('LISTING#');
    console.log(`✅ DynamoDB read: ${listings.length} listings found`);
  } catch (error) {
    console.log(`❌ DynamoDB read: ${error.message}`);
  }

  try {
    // Test S3 access
    const files = await s3Service.listFiles();
    console.log(`✅ S3 read: ${files.length} files found`);
  } catch (error) {
    console.log(`❌ S3 read: ${error.message}`);
  }

  // Test write operations for admin+ roles
  if (['admin', 'super_admin', 'owner'].includes(userRole)) {
    try {
      await dynamoService.putItem({
        PK: 'TEST#123',
        SK: 'META',
        testData: 'Hello World'
      });
      console.log('✅ DynamoDB write: Success');
    } catch (error) {
      console.log(`❌ DynamoDB write: ${error.message}`);
    }
  }
};
```

### 2. Test API Endpoints

```bash
# Test with different user tokens
curl -H "Authorization: Bearer <token>" \
     https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod/users

# Should return 403 for insufficient permissions
# Should return 401 for invalid/expired tokens
```

## Next Steps

1. **Implement the auth context** in your app root
2. **Create role-based components** for your specific use cases
3. **Test with different user roles** to ensure proper access control
4. **Add error handling** for authentication and authorization failures
5. **Implement logout functionality** and token refresh

## Support

For issues with the user management system, check:
1. CloudWatch logs for Lambda functions
2. Cognito user pool configuration
3. API Gateway CORS settings
4. User group assignments in Cognito

Refer to `USER_MANAGEMENT_GUIDE.md` for backend configuration and troubleshooting.
