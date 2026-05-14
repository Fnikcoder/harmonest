import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RoleService, UserRoleInfo } from '../../services/role.service';
import { AuthService, AuthUser } from '../../services/auth.service';
import { HasRoleDirective } from '../../directives/has-role.directive';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

@Component({
  selector: 'app-role-checker',
  standalone: true,
  imports: [CommonModule, HasRoleDirective, HasPermissionDirective],
  template: `
    <div class="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        <i class="fas fa-user-shield mr-2"></i>
        User Role Information
      </h3>

      <!-- Current User Info -->
      <div *ngIf="currentUser$ | async as user" class="mb-6">
        <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">Current User</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <strong>Name:</strong> {{user.firstName}} {{user.lastName}}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <strong>Email:</strong> {{user.email}}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <strong>Auth Role:</strong>
            <span class="ml-1 px-2 py-1 rounded text-xs"
                  [ngClass]="{
                    'bg-purple-100 text-purple-800': user.role === 'super_admin',
                    'bg-red-100 text-red-800': user.role === 'owner',
                    'bg-blue-100 text-blue-800': user.role === 'admin',
                    'bg-green-100 text-green-800': user.role === 'support',
                    'bg-gray-100 text-gray-800': user.role === 'user' || user.role === 'guest'
                  }">
              {{user.role}}
            </span>
          </p>
        </div>
      </div>

      <!-- JWT Role Info -->
      <div *ngIf="userRoleInfo$ | async as roleInfo" class="mb-6">
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">JWT Token Groups</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            <strong>Primary Role:</strong>
            <span class="ml-1 px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
              {{roleInfo.primaryRole}}
            </span>
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            <strong>All Groups:</strong>
          </p>
          <div class="flex flex-wrap gap-2">
            <span *ngFor="let group of roleInfo.groups"
                  class="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
              {{group}}
            </span>
            <span *ngIf="roleInfo.groups.length === 0"
                  class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
              No groups found
            </span>
          </div>
        </div>
      </div>

      <!-- Management Access Check -->
      <div class="mb-6">
        <h4 class="font-medium text-gray-900 dark:text-white mb-3">Access Checks</h4>
        <div class="space-y-2">
          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded">
            <span class="text-sm text-gray-700 dark:text-gray-300">Management Panel Access</span>
            <span *ngIf="hasManagementAccess$ | async"
                  class="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
              ✓ Granted
            </span>
            <span *ngIf="!(hasManagementAccess$ | async)"
                  class="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
              ✗ Denied
            </span>
          </div>

          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded">
            <span class="text-sm text-gray-700 dark:text-gray-300">Admin Level Access</span>
            <span *ngIf="isAdminLevel$ | async"
                  class="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
              ✓ Granted
            </span>
            <span *ngIf="!(isAdminLevel$ | async)"
                  class="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
              ✗ Denied
            </span>
          </div>

          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded">
            <span class="text-sm text-gray-700 dark:text-gray-300">Owner Level Access</span>
            <span *ngIf="isOwnerLevel$ | async"
                  class="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
              ✓ Granted
            </span>
            <span *ngIf="!(isOwnerLevel$ | async)"
                  class="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
              ✗ Denied
            </span>
          </div>
        </div>
      </div>

      <!-- Role-based Content Display -->
      <div class="mb-6">
        <h4 class="font-medium text-gray-900 dark:text-white mb-3">Role-based Content</h4>
        <div class="space-y-2">
          <div *appHasRole="'super_admin'" class="p-3 bg-purple-50 border border-purple-200 rounded">
            <p class="text-sm text-purple-800">🔥 Super Admin exclusive content</p>
          </div>

          <div *appHasRole="'owner'" class="p-3 bg-red-50 border border-red-200 rounded">
            <p class="text-sm text-red-800">👑 Owner exclusive content</p>
          </div>

          <div *appHasRole="'admin'" class="p-3 bg-blue-50 border border-blue-200 rounded">
            <p class="text-sm text-blue-800">⚙️ Admin exclusive content</p>
          </div>

          <div *appHasRole="['admin', 'owner', 'super_admin']" class="p-3 bg-green-50 border border-green-200 rounded">
            <p class="text-sm text-green-800">🛡️ Management level content (admin, owner, or super_admin)</p>
          </div>

          <div *appHasPermission="'manage_users'" class="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p class="text-sm text-yellow-800">👥 User management permission content</p>
          </div>
        </div>
      </div>

      <!-- Refresh Button -->
      <div class="flex justify-end">
        <button (click)="refreshRoleInfo()"
                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
          <i class="fas fa-refresh mr-2"></i>
          Refresh Role Info
        </button>
      </div>
    </div>
  `
})
export class RoleCheckerComponent implements OnInit {
  currentUser$: Observable<AuthUser | null>;
  userRoleInfo$: Observable<UserRoleInfo>;
  hasManagementAccess$: Observable<boolean>;
  isAdminLevel$: Observable<boolean>;
  isOwnerLevel$: Observable<boolean>;

  constructor(
    private roleService: RoleService,
    private authService: AuthService
  ) {
    // Initialize observables in constructor
    this.currentUser$ = this.roleService.getCurrentUser();
    this.userRoleInfo$ = this.roleService.getCurrentUserRoleInfo();
    this.hasManagementAccess$ = this.roleService.hasManagementAccess();
    this.isAdminLevel$ = this.roleService.isAdminLevel();
    this.isOwnerLevel$ = this.roleService.isOwnerLevel();
  }

  ngOnInit() {
    // Component initialization
  }

  refreshRoleInfo() {
    // Re-initialize observables to refresh data
    this.currentUser$ = this.roleService.getCurrentUser();
    this.userRoleInfo$ = this.roleService.getCurrentUserRoleInfo();
    this.hasManagementAccess$ = this.roleService.hasManagementAccess();
    this.isAdminLevel$ = this.roleService.isAdminLevel();
    this.isOwnerLevel$ = this.roleService.isOwnerLevel();
  }
}
