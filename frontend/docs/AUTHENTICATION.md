# Harmonest Authentication System

This document describes the comprehensive authentication and authorization system implemented for the Harmonest application using AWS Cognito and custom role-based access control.

## Overview

The authentication system provides:
- **AWS Cognito Integration** for secure user authentication
- **Role-based Authorization** with 5 user roles (Super Admin, Owner, Admin, Support, User/Guest)
- **Social Login** support (Google, Facebook, Apple)
- **Multi-Factor Authentication** for super admin/admin/owner roles on new devices
- **Anonymous Booking Access** for guests without login
- **JWT Token Management** with automatic refresh
- **Device Trust Management** for enhanced security

## User Roles & Permissions

### 1. Super Admin (`super_admin`)
- **Ultimate system access** with all Owner permissions plus:
- System administration and global configuration
- Security management and audit controls
- Can manage all users including other admins and owners
- Access to all system resources and configurations
- Advanced analytics and system monitoring

### 2. Owner (`owner`)
- **Full system access**
- Can manage users and roles
- Access to all DynamoDB tables and S3 buckets
- System configuration and settings
- Analytics and reporting

### 3. Admin (`admin`)
- **Almost full access** except user management
- Cannot add/remove users or change roles
- Full access to properties, bookings, payments
- Analytics and reporting
- System settings (limited)

### 4. Support (`support`)
- **Booking management** and modifications
- Access to all bookings across all properties
- Future access to chat system
- Customer data access (limited)
- Refund processing

### 5. User/Guest (`user`/`guest`)
- **Read access** to their own bookings
- Can update limited personal data
- Make new bookings
- **Anonymous access** via booking confirmation codes

## Authentication Flow

### Standard Login Flow
1. User enters email/password
2. AWS Cognito validates credentials
3. MFA challenge (if required for role)
4. JWT tokens issued
5. User data synced with DynamoDB
6. Role-based permissions applied

### Anonymous Booking Access
1. User provides booking confirmation code + email/phone
2. System validates against booking data
3. Temporary access token issued (24-hour expiry)
4. Limited access to booking-related data only

## Setup Instructions

### 1. AWS Cognito Configuration

Run the Cognito setup script:
```bash
cd aws_cli
chmod +x create_cognito_authentication.sh
./create_cognito_authentication.sh
```

This will create:
- Cognito User Pool with custom attributes
- User Pool Client with OAuth configuration
- Identity Pool for AWS resource access

### 2. Environment Configuration

Update your environment files with the Cognito configuration:

**src/environments/environment.ts** (Development):
```typescript
cognito: {
  region: 'eu-central-1',
  userPoolId: 'eu-central-1_XXXXXXXXX',
  userPoolWebClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  identityPoolId: 'eu-central-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
  oauth: {
    domain: 'harmonest-dev-users.auth.eu-central-1.amazoncognito.com',
    scope: ['openid', 'email', 'profile'],
    redirectSignIn: 'http://localhost:4200/auth/callback',
    redirectSignOut: 'http://localhost:4200/auth/logout',
    responseType: 'code'
  }
}
```

### 3. Social Provider Setup

Configure social identity providers in AWS Cognito Console:

#### Google OAuth
1. Create Google OAuth client in Google Cloud Console
2. Add client ID to Cognito User Pool
3. Configure redirect URIs

#### Facebook Login
1. Create Facebook App in Facebook Developers
2. Add App ID to Cognito User Pool
3. Configure OAuth redirect URIs

#### Apple Sign In
1. Configure Apple Sign In in Apple Developer Console
2. Add Service ID to Cognito User Pool
3. Set up domain verification

## Usage Examples

### Authentication Service

```typescript
import { AuthService } from './services/auth.service';

// Sign up new user
this.authService.signUp({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+1234567890'
}).subscribe(result => {
  console.log('User created:', result);
});

// Sign in
this.authService.signIn({
  email: 'user@example.com',
  password: 'SecurePass123!'
}).subscribe(user => {
  console.log('Logged in:', user);
});

// Check permissions
if (this.authService.hasPermission('manage_bookings')) {
  // User can manage bookings
}
```

### Route Protection

```typescript
// In app.routes.ts
{
  path: 'admin',
  component: AdminComponent,
  canActivate: [AuthGuard, RoleGuard],
  data: { roles: ['super_admin', 'owner', 'admin'] }
},
{
  path: 'bookings',
  component: BookingsComponent,
  canActivate: [AuthGuard, RoleGuard],
  data: { permissions: ['manage_bookings'] }
}
```

### Anonymous Booking Access

```typescript
import { BookingAccessService } from './services/booking-access.service';

// Verify booking access
this.bookingAccessService.verifyBookingAccess({
  confirmationCode: 'ABC123',
  email: 'guest@example.com'
}).subscribe(result => {
  if (result.success) {
    // Access granted to booking data
    console.log('Booking:', result.booking);
  }
});
```

## Security Features

### Multi-Factor Authentication
- **Required for**: Super Admin, Owner and Admin roles
- **Triggered on**: New device login
- **Methods**: TOTP, SMS, Email
- **Setup**: Automatic prompt on first super admin/admin/owner login

### Device Trust
- **Duration**: 30 days (configurable)
- **Storage**: Secure device fingerprinting
- **Revocation**: Manual device management in user profile

### Token Management
- **Access Token**: 1 hour expiry
- **Refresh Token**: 30 days expiry
- **Automatic Refresh**: Handled by interceptors
- **Secure Storage**: HttpOnly cookies (production)

### Session Security
- **Timeout**: 8 hours of inactivity
- **Extension**: Automatic on user activity
- **Concurrent Sessions**: Limited per user
- **Logout**: Secure token revocation

## API Integration

### Authentication Headers
```typescript
// Automatic via AuthInterceptor
Authorization: Bearer <jwt-access-token>
Content-Type: application/json
```

### Anonymous Booking Headers
```typescript
// For booking access without login
X-Booking-Confirmation: ABC123
X-Booking-Email: guest@example.com
```

## Error Handling

### Common Error Codes
- `401 Unauthorized`: Invalid or expired token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: User or resource not found
- `429 Too Many Requests`: Rate limiting

### Error Response Format
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to access this resource",
    "details": {
      "required_role": "admin",
      "user_role": "user"
    }
  }
}
```

## Testing

### Unit Tests
```bash
ng test --include="**/*.auth.spec.ts"
```

### Integration Tests
```bash
ng e2e --suite=authentication
```

### Manual Testing Checklist
- [ ] User registration and email verification
- [ ] Login with email/password
- [ ] Social login (Google, Facebook, Apple)
- [ ] MFA setup and verification
- [ ] Role-based access control
- [ ] Anonymous booking access
- [ ] Token refresh and expiry
- [ ] Device trust management
- [ ] Password reset flow

## Troubleshooting

### Common Issues

1. **Cognito Configuration Errors**
   - Verify User Pool ID and Client ID
   - Check OAuth redirect URIs
   - Ensure proper IAM permissions

2. **Social Login Issues**
   - Verify provider client IDs
   - Check redirect URI configuration
   - Ensure provider apps are active

3. **Permission Denied Errors**
   - Check user role assignment
   - Verify route guard configuration
   - Review permission mappings

4. **Token Refresh Issues**
   - Check token expiry settings
   - Verify refresh token validity
   - Review interceptor configuration

## Security Best Practices

1. **Password Policy**: Enforce strong passwords
2. **MFA**: Required for privileged roles
3. **Token Rotation**: Regular refresh token rotation
4. **Device Management**: Monitor and revoke suspicious devices
5. **Audit Logging**: Track authentication events
6. **Rate Limiting**: Prevent brute force attacks
7. **HTTPS Only**: Secure token transmission
8. **Secure Storage**: Protect sensitive data

## Monitoring & Analytics

### Key Metrics
- Login success/failure rates
- MFA adoption rates
- Social login usage
- Session duration
- Device trust patterns
- Permission denied events

### Alerts
- Multiple failed login attempts
- Suspicious device activity
- Token manipulation attempts
- Privilege escalation attempts

## Future Enhancements

1. **Biometric Authentication** (Face ID, Touch ID)
2. **Risk-based Authentication** (IP, location, behavior)
3. **Single Sign-On (SSO)** integration
4. **Advanced Device Fingerprinting**
5. **Passwordless Authentication** (WebAuthn)
6. **Enhanced Audit Logging**
7. **Real-time Security Monitoring**
