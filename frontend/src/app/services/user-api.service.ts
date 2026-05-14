import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ConfigService } from './config.service';

export interface ApiUser {
  userId: string;
  email: string;
  enabled: boolean;
  groups: string[];
  attributes: {
    email_verified?: string;
    given_name?: string;
    family_name?: string;
    [key: string]: any;
  };
  userCreateDate: string;
  userLastModifiedDate: string;
}

export interface CreateUserRequest {
  email: string;
  temporaryPassword: string;
  groups: string[];
  attributes?: {
    given_name?: string;
    family_name?: string;
    [key: string]: any;
  };
}

export interface UpdateUserGroupsRequest {
  groups: string[];
}

export interface UpdateUserStatusRequest {
  enabled: boolean;
}

export interface UsersResponse {
  users: ApiUser[];
  nextToken?: string;
  totalCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserApiService {
  private baseUrl: string = '';

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.initializeBaseUrl();
  }

  private initializeBaseUrl(): void {
    const config = this.configService.getConfig();
    if (config?.technical?.apis?.userManagement?.baseUrl) {
      this.baseUrl = config.technical.apis.userManagement.baseUrl;
    } else {
      // Subscribe to config changes
      this.configService.getConfigObservable().subscribe(loadedConfig => {
        if (loadedConfig?.technical?.apis?.userManagement?.baseUrl) {
          this.baseUrl = loadedConfig.technical.apis.userManagement.baseUrl;
        }
      });
    }
  }

  /**
   * Get authentication headers with JWT token
   */
  private async getAuthHeaders(): Promise<HttpHeaders> {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.idToken) {
        throw new Error('No valid authentication token available');
      }

      return new HttpHeaders({
        'Authorization': `Bearer ${session.tokens.idToken.toString()}`,
        'Content-Type': 'application/json'
      });
    } catch (error) {
      console.error('❌ [UserApiService] Failed to get auth headers:', error);
      throw new Error('Authentication required. Please sign in.');
    }
  }

  /**
   * Make authenticated API request
   */
  private makeAuthenticatedRequest<T>(
    method: string,
    endpoint: string,
    body?: any,
    params?: HttpParams
  ): Observable<T> {
    if (!this.baseUrl) {
      return throwError(() => new Error('User Management API URL not configured'));
    }

    return from(this.getAuthHeaders()).pipe(
      switchMap(headers => {
        // Use specific HTTP methods instead of generic request
        switch (method.toUpperCase()) {
          case 'GET':
            return this.http.get<T>(`${this.baseUrl}${endpoint}`, { headers, params });
          case 'POST':
            return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, { headers, params });
          case 'PUT':
            return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, { headers, params });
          case 'DELETE':
            return this.http.delete<T>(`${this.baseUrl}${endpoint}`, { headers, params });
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }
      }),
      catchError(error => {
        console.error(`❌ [UserApiService] API request failed:`, error);

        if (error.status === 401) {
          return throwError(() => new Error('Authentication failed. Please sign in again.'));
        } else if (error.status === 403) {
          return throwError(() => new Error('Access denied. Insufficient permissions.'));
        } else if (error.status === 404) {
          return throwError(() => new Error('Resource not found.'));
        } else {
          return throwError(() => new Error(`API request failed: ${error.message || 'Unknown error'}`));
        }
      })
    );
  }

  /**
   * List users with pagination
   */
  getUsers(limit: number = 50, nextToken?: string): Observable<UsersResponse> {
    let params = new HttpParams().set('limit', limit.toString());
    if (nextToken) {
      params = params.set('nextToken', nextToken);
    }

    return this.makeAuthenticatedRequest<UsersResponse>('GET', '/users', undefined, params);
  }

  /**
   * Get user details by ID
   */
  getUser(userId: string): Observable<ApiUser> {
    return this.makeAuthenticatedRequest<ApiUser>('GET', `/users/${userId}`);
  }

  /**
   * Create a new user
   */
  createUser(userData: CreateUserRequest): Observable<ApiUser> {
    return this.makeAuthenticatedRequest<ApiUser>('POST', '/users', userData);
  }

  /**
   * Update user groups/roles
   */
  updateUserGroups(userId: string, groups: string[]): Observable<ApiUser> {
    const request: UpdateUserGroupsRequest = { groups };
    return this.makeAuthenticatedRequest<ApiUser>('PUT', `/users/${userId}/groups`, request);
  }

  /**
   * Enable or disable user
   */
  updateUserStatus(userId: string, enabled: boolean): Observable<ApiUser> {
    const request: UpdateUserStatusRequest = { enabled };
    return this.makeAuthenticatedRequest<ApiUser>('PUT', `/users/${userId}/status`, request);
  }

  /**
   * Delete user
   */
  deleteUser(userId: string): Observable<void> {
    return this.makeAuthenticatedRequest<void>('DELETE', `/users/${userId}`);
  }

  /**
   * Get current user's profile
   */
  getCurrentUserProfile(): Observable<ApiUser> {
    return this.makeAuthenticatedRequest<ApiUser>('GET', '/users/me');
  }

  /**
   * Update current user's profile
   */
  updateCurrentUserProfile(attributes: any): Observable<ApiUser> {
    return this.makeAuthenticatedRequest<ApiUser>('PUT', '/users/me', { attributes });
  }

  /**
   * Check if API is available
   */
  checkApiHealth(): Observable<any> {
    if (!this.baseUrl) {
      return throwError(() => new Error('User Management API URL not configured'));
    }

    return this.http.get(`${this.baseUrl}/health`).pipe(
      catchError(error => {
        console.error('❌ [UserApiService] API health check failed:', error);
        return throwError(() => new Error('User Management API is not available'));
      })
    );
  }
}
