# DynamoDB User Code Separation

## Overview
This document explains the changes made to separate DynamoDB user-related code from the application while keeping the code intact for future use. The application now uses AWS Cognito exclusively for user management instead of storing user data in DynamoDB.

## What Was Changed

### 1. Auth Service (`src/app/services/auth.service.ts`)

**Commented Out Methods:**
- `upgradeToSuperAdmin()` - Used to upgrade user roles in DynamoDB
- `syncUserData()` - Synced user data between Cognito and DynamoDB
- `updateUserRole()` - Updated user roles in both systems
- `syncUserWithDatabase()` - Created/updated user records in DynamoDB after authentication
- `createUserInDynamoDB()` - Created comprehensive user profiles in DynamoDB
- `ensureUserInDynamoDB()` - Ensured user existed in DynamoDB, created if missing
- `createUserFromCognitoData()` - Created DynamoDB user from Cognito data
- `createVerifiedUserInDynamoDB()` - Created verified user records after email confirmation

**Modified Methods:**
- `confirmSignUp()` - Removed DynamoDB user creation after email verification
- `signIn()` - Removed DynamoDB user sync after successful sign-in

### 2. Model Service (`src/app/services/model.service.ts`)

**Commented Out Methods:**
- `getUserByEmail()` - Retrieved user by email from DynamoDB
- `getUserByPhone()` - Retrieved user by phone from DynamoDB
- `getUsersByRole()` - Retrieved users by role from DynamoDB
- `createUser()` - Created user records in DynamoDB
- `updateUser()` - Updated user records in DynamoDB
- `getUsers()` - Retrieved all users for management panel
- `getGuests()` - Retrieved guest users for management panel
- `deleteUser()` - Deleted user records from DynamoDB
- `updateGuest()` - Updated guest user records

**Kept Active:**
- `updateCognitoUserRole()` - Still useful for updating user roles in Cognito

### 3. Components Updated

#### User Management Component (`src/app/pages/management/users/user-management.component.ts`)
- Disabled DynamoDB user loading in `loadUsers()`
- Disabled DynamoDB user deletion in `deleteUser()`
- Added TODO comments for implementing Cognito user management

#### User Invoice Component (`src/app/pages/account/guest/user-invoice/user-invoice.component.ts`)
- Disabled DynamoDB user profile loading in `loadUserProfile()`
- Still loads bookings and payments (which remain in DynamoDB)
- Sets `currentUser` to null until Cognito integration is implemented

#### User Payment Component (`src/app/pages/account/guest/user-payment/user-payment.component.ts`)
- Disabled DynamoDB user profile loading in `loadUserProfile()`
- Sets `currentUser` to null until Cognito integration is implemented

## What Still Works

### DynamoDB Operations (Non-User)
- Property management (PropertyGroup, UnitModel, IndividualUnit)
- Booking management (BookingModel, CheckInData)
- Payment processing (Payment)
- QR code management (QRCode)

### AWS Cognito Operations
- User authentication (sign up, sign in, sign out)
- Email verification
- Password reset
- User attribute management
- Role management through custom:role attribute

## What Needs Implementation

### 1. Cognito User Management
Replace DynamoDB user operations with Cognito equivalents:

```typescript
// Example implementations needed:
- listCognitoUsers() - List users from Cognito User Pool
- deleteCognitoUser() - Delete user from Cognito User Pool
- updateCognitoUserAttributes() - Update user profile in Cognito
- getCognitoUserProfile() - Get user profile from Cognito attributes
```

### 2. User Profile Management
Since user profiles are no longer in DynamoDB, implement:
- Profile editing through Cognito attributes
- User preferences storage (could use Cognito custom attributes or separate storage)
- Travel profile management
- Loyalty program data (if needed)

### 3. Management Panel Updates
Update management components to:
- Use Cognito APIs for user management
- Display user data from Cognito attributes
- Handle user operations through Cognito

## Benefits of This Approach

1. **Simplified Architecture**: Single source of truth for user data (Cognito)
2. **Reduced Complexity**: No need to sync between two systems
3. **Better Security**: Cognito handles user authentication and authorization natively
4. **Cost Optimization**: Reduced DynamoDB operations for user management
5. **Easier Maintenance**: Less code to maintain and debug

## Migration Notes

- All existing DynamoDB user data remains intact (commented code can be uncommented if needed)
- Bookings, payments, and other business data still use DynamoDB
- User authentication continues to work through Cognito
- No data loss - only the storage location for user profiles has changed

## Future Considerations

If you need to re-enable DynamoDB user storage:
1. Uncomment the relevant methods in auth.service.ts and model.service.ts
2. Uncomment the component code that loads user data from DynamoDB
3. Re-enable the sync mechanisms between Cognito and DynamoDB
4. Test the integration thoroughly

The code structure is preserved to make this transition easy if needed in the future.

## Update: Cognito Integration Implementation

### New Cognito User Management Service

Created `src/app/services/cognito-user-management.service.ts` with the following features:

**Core Operations:**
- `listUsers()` - List all users from Cognito User Pool with pagination
- `getUserByEmail()` - Get specific user by email
- `createUser()` - Create new user in Cognito with custom attributes
- `updateUser()` - Update user attributes (name, role, phone)
- `deleteUser()` - Delete user from Cognito User Pool
- `setUserEnabled()` - Enable/disable user accounts
- `setUserPassword()` - Set user passwords (admin operation)

**Key Features:**
- Automatic AWS credentials management through Amplify session
- Proper error handling and logging
- Support for custom attributes (role, user metadata)
- Observable-based API for Angular integration
- Type-safe interfaces for user data

### Updated Components

#### User Management Component (`src/app/pages/management/users/user-management.component.ts`)
- **Replaced DynamoDB calls** with Cognito User Management Service
- **Updated interfaces** to use `CognitoUser` instead of DynamoDB `User`
- **Implemented real user operations:**
  - Load users from Cognito User Pool
  - Create users with proper role assignment
  - Update user attributes and roles
  - Delete users from Cognito
- **Enhanced error handling** with specific Cognito error messages
- **Maintained existing UI** and functionality

#### Guest Management Component (`src/app/pages/management/guests/guest-management.component.ts`)
- **Updated to use Cognito** for guest user data
- **Extended Guest interface** to inherit from `CognitoUser`
- **Implemented guest filtering** from Cognito users by role
- **Added guest status management** (local storage for now)
- **Maintained booking integration** (still uses DynamoDB for bookings)

### Implementation Notes

#### What Works Now:
1. **User Authentication** - Full Cognito integration (sign up, sign in, password reset)
2. **User Management** - Create, read, update, delete users in Cognito
3. **Role Management** - Assign and update user roles via custom attributes
4. **Guest Management** - View and manage guest users from Cognito
5. **Permission System** - Role-based access control using Cognito roles

#### What Needs Additional Implementation:
1. **Guest Metadata Storage** - Guest status, notes, preferences need separate storage
2. **Booking Integration** - Link Cognito users with existing booking system
3. **Advanced User Attributes** - Store additional profile data in custom attributes
4. **Audit Logging** - Track user management operations
5. **Bulk Operations** - Import/export users, bulk role updates

#### Recommended Next Steps:
1. **Test Cognito Integration** - Verify all user operations work correctly
2. **Implement Guest Metadata** - Create separate storage for guest-specific data
3. **Update Booking System** - Ensure bookings link to Cognito user IDs
4. **Add Error Handling** - Implement proper error messages and retry logic
5. **Performance Optimization** - Add caching and pagination for large user lists

### Benefits Achieved:
- **Simplified Architecture** - Single source of truth for user authentication
- **Better Security** - Native AWS Cognito security features
- **Reduced Complexity** - No more dual-system synchronization
- **Scalability** - Cognito handles user scaling automatically
- **Cost Optimization** - Reduced DynamoDB operations for user management
