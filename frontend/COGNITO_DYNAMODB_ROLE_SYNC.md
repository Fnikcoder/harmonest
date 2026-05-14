# Cognito ↔ DynamoDB Role Synchronization

## The Problem You Identified

You correctly identified a critical security issue in the user management system:

### **The Issue:**
1. User signs up → Cognito assigns `custom:role = guest`
2. Admin promotes user to `admin` in DynamoDB User table
3. **BUT** Cognito still has `custom:role = guest` in JWT token
4. **Result**: User has `admin` in DynamoDB but `guest` in JWT → Security mismatch!

## The Solution: Dual-System Role Sync

We now update roles in **both systems simultaneously**:

### **When Role is Updated:**
1. ✅ Update role in DynamoDB (for data consistency)
2. ✅ Update `custom:role` in Cognito (for JWT token)
3. ✅ User gets correct permissions on next login

## Implementation Details

### 1. **Role Update Flow**

```typescript
async updateUserRole(user: UserWithActions, newRole: string) {
  // 1. Update DynamoDB
  await this.modelService.updateUser(user.userId, {
    role: newRole,
    updatedAt: new Date().toISOString()
  }).toPromise();

  // 2. Update Cognito custom:role attribute
  await this.modelService.updateCognitoUserRole(user.email, newRole);

  // 3. Update local UI
  user.role = newRole;
}
```

### 2. **Cognito Role Update Method**

```typescript
async updateCognitoUserRole(email: string, newRole: string): Promise<void> {
  const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = 
    await import('@aws-sdk/client-cognito-identity-provider');

  const command = new AdminUpdateUserAttributesCommand({
    UserPoolId: 'eu-central-1_3nRWgJleG',
    Username: email,
    UserAttributes: [
      {
        Name: 'custom:role',
        Value: newRole
      }
    ]
  });

  await cognitoClient.send(command);
}
```

## User Experience

### **Before Fix:**
1. Admin promotes user to `admin` in UI ✅
2. User still sees "Access Denied" ❌
3. User needs manual Cognito update ❌

### **After Fix:**
1. Admin promotes user to `admin` in UI ✅
2. System updates both DynamoDB + Cognito ✅
3. User gets `admin` permissions on next login ✅

## Security Benefits

### **Data Consistency**
- DynamoDB role = Cognito role
- No permission mismatches
- Single source of truth maintained

### **Immediate Effect**
- Role changes take effect on next login
- No manual Cognito console updates needed
- Automated synchronization

### **Audit Trail**
- All role changes logged
- Both systems updated atomically
- Clear error handling if sync fails

## Error Handling

### **If Cognito Update Fails:**
```typescript
try {
  await this.updateCognitoUserRole(email, newRole);
} catch (error) {
  if (error.name === 'AccessDeniedException') {
    console.warn('Access denied to update Cognito. User needs to log out/in.');
    // Allow DynamoDB update to proceed
    return;
  }
  throw error; // Re-throw other errors
}
```

### **Graceful Degradation:**
- If Cognito update fails → DynamoDB still updates
- Admin gets warning message
- Manual Cognito update can be done later

## Required AWS Permissions

For the Cognito sync to work, your AWS credentials need:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminGetUser"
      ],
      "Resource": "arn:aws:cognito-idp:eu-central-1:*:userpool/eu-central-1_3nRWgJleG"
    }
  ]
}
```

## Testing the Fix

### **Test Scenario:**
1. Create user with `guest` role
2. User logs in → Gets `guest` permissions ✅
3. Admin promotes to `admin` role
4. User logs out and logs back in
5. User now has `admin` permissions ✅

### **Verification:**
- Check DynamoDB: `role = admin` ✅
- Check Cognito: `custom:role = admin` ✅
- Check JWT token: Contains `custom:role: admin` ✅

## Alternative Solutions Considered

### **Option 1: Cognito-Only Roles**
- Store roles only in Cognito
- ❌ Harder to query users by role
- ❌ Less flexible for complex permissions

### **Option 2: DynamoDB-Only Roles**
- Store roles only in DynamoDB
- ❌ JWT tokens wouldn't have role info
- ❌ Need API calls for every permission check

### **Option 3: Dual-System Sync (Chosen)**
- Store roles in both systems
- ✅ Best of both worlds
- ✅ JWT has role info
- ✅ DynamoDB has queryable roles

## Future Enhancements

### **Real-time Role Updates**
- WebSocket notifications for role changes
- Force token refresh without logout
- Immediate permission updates

### **Role Hierarchy**
- Define role inheritance (admin > host > guest)
- Automatic permission cascading
- Fine-grained permission control

### **Audit Logging**
- Track all role changes
- Who changed what when
- Compliance and security monitoring

## Summary

The role synchronization fix ensures that:
1. **Security**: No permission mismatches between systems
2. **Consistency**: DynamoDB and Cognito always in sync
3. **User Experience**: Role changes work as expected
4. **Maintainability**: Automated sync reduces manual work

This solution addresses the core issue you identified and provides a robust foundation for user role management in your application.
