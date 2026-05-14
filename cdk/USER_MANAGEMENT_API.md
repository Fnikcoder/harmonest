# HarmoNest User Management API - Angular TypeScript Guide

Complete guide for integrating user authentication and management with Angular TypeScript frontend.

## 🔐 Authentication Configuration

### Cognito Configuration
```typescript
export const cognitoConfig = {
  userPoolId: 'eu-central-1_oOMDUFanW',
  userPoolWebClientId: '4jm7vgta4tc7r5chltr4eb4kqj',
  region: 'eu-central-1',
  identityPoolId: 'eu-central-1:434a4973-03f1-4074-929b-de185a7cd4ac'
};

export const apiConfig = {
  baseUrl: 'https://8y8k22wgzj.execute-api.eu-central-1.amazonaws.com/prod',
  region: 'eu-central-1'
};
```

### Angular Setup
```bash
npm install aws-amplify @aws-amplify/ui-angular
```

```typescript
// main.ts
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_oOMDUFanW',
    userPoolWebClientId: '4jm7vgta4tc7r5chltr4eb4kqj',
    identityPoolId: 'eu-central-1:434a4973-03f1-4074-929b-de185a7cd4ac'
  }
});
```

## 🔑 Test Credentials

```typescript
const testCredentials = {
  admin: {
    email: 'support@harmonest.de',
    password: 'HarmoNest2024!',
    role: 'admin'
  },
  superAdmin: {
    email: 'fnikcoder@gmail.com',
    password: 'HarmoNest2024!',
    role: 'super_admin'
  }
};
```

## 👥 User Roles

| Role | Level | Permissions |
|------|-------|-------------|
| `guest` | 1 | View public content |
| `support` | 2 | Handle support tickets |
| `admin` | 3 | Manage users |
| `super_admin` | 4 | System administration |
| `owner` | 5 | Full access |

## 🚀 Authentication Service

```typescript
// auth.service.ts
import { Injectable } from '@angular/core';
import { Auth } from 'aws-amplify';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserRole {
  groups: string[];
  primaryRole: string;
  hasRole: (role: string) => boolean;
  hasMinimumRole: (minRole: string) => boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<any>(null);
  private roleSubject = new BehaviorSubject<UserRole | null>(null);

  public user$ = this.userSubject.asObservable();
  public role$ = this.roleSubject.asObservable();

  private readonly roleHierarchy = {
    'guest': 1,
    'support': 2,
    'admin': 3,
    'super_admin': 4,
    'owner': 5
  };

  constructor() {
    this.checkAuthState();
  }

  async signIn(email: string, password: string): Promise<any> {
    try {
      const user = await Auth.signIn(email, password);
      await this.updateUserRole();
      return user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await Auth.signOut();
      this.userSubject.next(null);
      this.roleSubject.next(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<any> {
    try {
      const user = await Auth.currentAuthenticatedUser();
      this.userSubject.next(user);
      await this.updateUserRole();
      return user;
    } catch (error) {
      this.userSubject.next(null);
      this.roleSubject.next(null);
      return null;
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      const session = await Auth.currentSession();
      return session.getAccessToken().getJwtToken();
    } catch (error) {
      return null;
    }
  }

  private async updateUserRole(): Promise<void> {
    try {
      const session = await Auth.currentSession();
      const idToken = session.getIdToken();
      const groups = idToken.payload['cognito:groups'] || [];
      
      const primaryRole = groups.reduce((highest: string, group: string) => {
        return this.roleHierarchy[group] > this.roleHierarchy[highest] ? group : highest;
      }, 'guest');

      const userRole: UserRole = {
        groups,
        primaryRole,
        hasRole: (role: string) => groups.includes(role),
        hasMinimumRole: (minRole: string) => 
          this.roleHierarchy[primaryRole] >= this.roleHierarchy[minRole]
      };

      this.roleSubject.next(userRole);
    } catch (error) {
      console.error('Error updating user role:', error);
      this.roleSubject.next(null);
    }
  }

  private async checkAuthState(): Promise<void> {
    try {
      await this.getCurrentUser();
    } catch (error) {
      // User not authenticated
    }
  }
}
```

## 📡 User Management Service

```typescript
// user-management.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface User {
  userId: string;
  email: string;
  groups: string[];
  enabled: boolean;
  createdAt?: string;
  lastModified?: string;
}

export interface CreateUserRequest {
  email: string;
  temporaryPassword: string;
  groups: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private readonly baseUrl = 'https://8y8k22wgzj.execute-api.eu-central-1.amazonaws.com/prod';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): Observable<HttpHeaders> {
    return from(this.authService.getAccessToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        });
        return [headers];
      })
    );
  }

  // Get all users
  getUsers(): Observable<User[]> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.get<User[]>(`${this.baseUrl}/users`, { headers })
      )
    );
  }

  // Get specific user
  getUser(userId: string): Observable<User> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.get<User>(`${this.baseUrl}/users/${userId}`, { headers })
      )
    );
  }

  // Create new user
  createUser(userData: CreateUserRequest): Observable<User> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.post<User>(`${this.baseUrl}/users`, userData, { headers })
      )
    );
  }

  // Update user groups
  updateUserGroups(userId: string, groups: string[]): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.put(`${this.baseUrl}/users/${userId}/groups`, 
          { groups }, 
          { headers }
        )
      )
    );
  }

  // Enable/disable user
  updateUserStatus(userId: string, enabled: boolean): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.put(`${this.baseUrl}/users/${userId}/status`, 
          { enabled }, 
          { headers }
        )
      )
    );
  }
}
```

## 📋 API Endpoints

### Base URL
```
https://8y8k22wgzj.execute-api.eu-central-1.amazonaws.com/prod
```

### Authentication
All API calls require Bearer token in Authorization header:
```typescript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

### Endpoints

| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| GET | `/users` | List all users | admin+ |
| POST | `/users` | Create new user | admin+ |
| GET | `/users/{userId}` | Get user details | admin+ |
| PUT | `/users/{userId}/groups` | Update user groups | admin+ |
| PUT | `/users/{userId}/status` | Enable/disable user | admin+ |

## 🔧 API Usage Examples

### 1. Get All Users
```typescript
// Request
GET /users
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

// Response
{
  "success": true,
  "data": [
    {
      "userId": "user-123",
      "email": "user@example.com",
      "groups": ["support"],
      "enabled": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 2. Create User
```typescript
// Request
POST /users
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "email": "newuser@example.com",
  "temporaryPassword": "TempPass123!",
  "groups": ["support"]
}

// Response
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "userId": "user-456",
    "email": "newuser@example.com",
    "groups": ["support"]
  }
}
```

### 3. Update User Groups
```typescript
// Request
PUT /users/user-123/groups
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "groups": ["admin", "support"]
}

// Response
{
  "success": true,
  "message": "User groups updated successfully"
}
```

### 4. Enable/Disable User
```typescript
// Request
PUT /users/user-123/status
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "enabled": false
}

// Response
{
  "success": true,
  "message": "User disabled successfully"
}
```

## 🎯 Component Examples

### Login Component
```typescript
// login.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
      <h2>Login to HarmoNest</h2>
      
      <input 
        type="email" 
        [(ngModel)]="credentials.email" 
        name="email" 
        placeholder="Email"
        required>
      
      <input 
        type="password" 
        [(ngModel)]="credentials.password" 
        name="password" 
        placeholder="Password"
        required>
      
      <button type="submit" [disabled]="!loginForm.valid || isLoading">
        {{ isLoading ? 'Signing in...' : 'Sign In' }}
      </button>
      
      <div *ngIf="errorMessage" class="error">
        {{ errorMessage }}
      </div>
    </form>
  `
})
export class LoginComponent {
  credentials = { email: '', password: '' };
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signIn(this.credentials.email, this.credentials.password);
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.errorMessage = error.message || 'Login failed';
    } finally {
      this.isLoading = false;
    }
  }
}
```

### User Management Component
```typescript
// user-management.component.ts
import { Component, OnInit } from '@angular/core';
import { UserManagementService, User } from '../services/user-management.service';

@Component({
  selector: 'app-user-management',
  template: `
    <div class="user-management">
      <h2>User Management</h2>
      
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Groups</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let user of users">
            <td>{{ user.email }}</td>
            <td>{{ user.groups.join(', ') }}</td>
            <td>{{ user.enabled ? 'Active' : 'Disabled' }}</td>
            <td>
              <button (click)="toggleUserStatus(user)">
                {{ user.enabled ? 'Disable' : 'Enable' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];

  constructor(private userManagementService: UserManagementService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.userManagementService.getUsers().subscribe({
      next: (users) => this.users = users,
      error: (error) => console.error('Error loading users:', error)
    });
  }

  toggleUserStatus(user: User): void {
    this.userManagementService.updateUserStatus(user.userId, !user.enabled).subscribe({
      next: () => {
        user.enabled = !user.enabled;
      },
      error: (error) => console.error('Error updating user status:', error)
    });
  }
}
```

## 🔍 Role Checking

### Check User Role in Component
```typescript
// Get current user role
this.authService.role$.subscribe(role => {
  if (role) {
    console.log('User role:', role.primaryRole);
    console.log('User groups:', role.groups);
    console.log('Is admin?', role.hasRole('admin'));
    console.log('Has minimum support role?', role.hasMinimumRole('support'));
  }
});
```

### Role-based UI
```typescript
// In template
<div *ngIf="(authService.role$ | async)?.hasRole('admin')">
  <admin-panel></admin-panel>
</div>

<div *ngIf="(authService.role$ | async)?.hasMinimumRole('support')">
  <support-tools></support-tools>
</div>
```

## 🔒 Error Handling

### Common Error Responses
```typescript
// Unauthorized (401)
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}

// Forbidden (403)
{
  "success": false,
  "error": "Forbidden", 
  "message": "Insufficient permissions"
}

// Validation Error (400)
{
  "success": false,
  "error": "ValidationError",
  "message": "Email is required"
}
```

### Error Handling in Service
```typescript
private handleError(error: any): Observable<never> {
  console.error('API Error:', error);
  
  if (error.status === 401) {
    // Token expired, redirect to login
    this.router.navigate(['/login']);
  }
  
  throw error;
}
```

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install aws-amplify @aws-amplify/ui-angular
   ```

2. **Configure Amplify** in `main.ts`

3. **Add services** to your module

4. **Use in components**:
   ```typescript
   // Sign in
   await this.authService.signIn('support@harmonest.de', 'HarmoNest2024!');
   
   // Get users (admin only)
   this.userManagementService.getUsers().subscribe(users => {
     console.log('Users:', users);
   });
   ```

## 📞 Support

- **Admin**: support@harmonest.de
- **Super Admin**: fnikcoder@gmail.com

---

**Ready to integrate! 🚀**
