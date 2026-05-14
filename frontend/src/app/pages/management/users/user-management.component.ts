import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ModelService } from '../../../services/model.service';
import { UserService, User, CreateUserRequest, UpdateUserRequest } from '../../../services/user.service';
import { hasPermission, hasAnyRole } from '../../../config/auth.config';
import * as feather from 'feather-icons';

interface UserWithActions extends User {
  isEditing?: boolean;
  showActions?: boolean;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-management.component.html'
})
export class UserManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  users: UserWithActions[] = [];
  filteredUsers: UserWithActions[] = [];
  loading = false;
  error: string | null = null;

  searchTerm = '';
  selectedRole = '';
  selectedStatus = '';

  currentPage = 1;
  pageSize = 10;
  nextToken?: string;

  showCreateModal = false;
  showEditModal = false;
  editingUser: UserWithActions | null = null;

  userForm: FormGroup;

  availableRoles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'host', label: 'Host' },
    { value: 'guest', label: 'Guest' }
  ];

  availableStatuses = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'deleted', label: 'Deleted' }
  ];

  constructor(
    private authService: AuthService,
    private modelService: ModelService,
    private userService: UserService,
    private fb: FormBuilder
  ) {
    this.userForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['guest', Validators.required],
      phone: [''],
      temporaryPassword: [''],
      sendWelcomeEmail: [true]
    });
  }

  ngOnInit() {
    this.checkUserPermissions();
  }

  checkUserPermissions() {
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(authState => {
        console.log('Auth State in User Management:', authState);

        if (authState.user) {
          const userRole = authState.user.role;
          console.log('Current user role:', userRole);
          console.log('Full user object:', authState.user);

          // Check if user has permission to manage users
          const canManageUsers = hasPermission(userRole, 'manage_users');
          const canViewUsers = hasPermission(userRole, 'view_users');
          const hasRequiredRole = hasAnyRole(userRole, ['super_admin', 'owner', 'admin']);

          console.log('Permission check results:', {
            canManageUsers,
            canViewUsers,
            hasRequiredRole,
            userRole
          });

          if (canManageUsers || canViewUsers || hasRequiredRole) {
            console.log('User has permission, loading users...');
            this.testConnectionAndLoadUsers();
          } else {
            console.log('Access denied for role:', userRole);
            this.error = `Access denied. You don't have permission to view users. Current role: ${userRole}`;
            this.loading = false;
          }
        } else {
          console.log('No user found in auth state');
          this.error = 'Please log in to access user management.';
          this.loading = false;
        }
      });
  }

  ngAfterViewInit() {
    this.refreshFeatherIcons();
  }

  private refreshFeatherIcons() {
    // Use multiple timeouts to ensure icons are replaced properly
    setTimeout(() => {
      feather.replace();
    }, 50);

    setTimeout(() => {
      feather.replace();
    }, 200);

    setTimeout(() => {
      feather.replace();
    }, 500);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async testConnectionAndLoadUsers() {
    console.log('Testing DynamoDB connection before loading users...');
    this.loading = true;
    this.error = null;

    try {
      // Test DynamoDB connection first
      const connectionTest = await this.modelService.testDynamoDBConnection();

      if (connectionTest) {
        console.log('DynamoDB connection successful, loading users...');
        await this.loadUsers();
      } else {
        console.error('DynamoDB connection failed');
        this.error = 'Failed to connect to database. Please check your AWS configuration and ensure you are properly authenticated.';
        this.loading = false;
      }
    } catch (error) {
      console.error('Error testing DynamoDB connection:', error);
      this.error = `Database connection error: ${error instanceof Error ? error.message : String(error)}`;
      this.loading = false;
    }
  }

  async loadUsers() {
    console.log('Starting to load users...');
    this.loading = true;
    this.error = null;

    try {
      console.log('Loading users from AWS Cognito User Pool...');

      // Use User Service to list users
      this.userService.listUsers(this.pageSize, this.nextToken)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('Raw users from Cognito:', response.users);
            console.log('Number of users found:', response.users.length);

            this.users = response.users.map(user => ({
              ...user,
              isEditing: false,
              showActions: false
            }));

            this.nextToken = response.nextToken;
            console.log('Processed users:', this.users);
            this.filterUsers();
            console.log('Filtered users:', this.filteredUsers);
            this.loading = false;

            // Ensure feather icons are replaced after data loads
            this.refreshFeatherIcons();
          },
          error: (error) => {
            console.error('Error loading users from Cognito:', error);
            this.error = 'Failed to load users from Cognito. Please check your permissions and try again.';
            this.loading = false;
          }
        });
    } catch (error) {
      console.error('Error loading users:', error);
      console.error('Error details:', error);
      this.error = `Failed to load users from database: ${(error)}`;
      this.loading = false;
    }
  }

  filterUsers() {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = !this.searchTerm ||
        user?.firstName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user?.lastName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesRole = !this.selectedRole || user.role === this.selectedRole;
      const matchesStatus = !this.selectedStatus || user.status === this.selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });

    // Ensure feather icons are replaced after filtering
    this.refreshFeatherIcons();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedRole = '';
    this.selectedStatus = '';
    this.filterUsers();
  }

  editUser(user: UserWithActions) {
    this.editingUser = user;
    this.userForm.patchValue({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      role: user.role,
      phone: user.phone || ''
    });
    this.showEditModal = true;
  }

  async toggleUserStatus(user: UserWithActions) {
    if (!this.hasUserManagementAccess()) {
      this.error = 'Access denied. Only Super Admins and Admins can modify users.';
      return;
    }

    try {
      // Update user status in DynamoDB
      // const updatedUser = await this.modelService.updateUser(user.userId, {
      //   status: user.status === 'active' ? 'suspended' : 'active',
      //   updatedAt: new Date().toISOString()
      // }).toPromise();

      // Update local state
      // user.status = user.status === 'CONFIRMED' ? 'suspended' : 'active';

      // Refresh feather icons to update the status toggle icon
      this.refreshFeatherIcons();

    } catch (error) {
      console.error('Error updating user status:', error);
      this.error = 'Failed to update user status';
    }
  }

  async deleteUser(user: UserWithActions) {
    if (!this.hasUserManagementAccess()) {
      this.error = 'Access denied. Only Super Admins and Admins can delete users.';
      return;
    }

    if (confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`)) {
      try {
        console.log('Deleting user from AWS Cognito User Pool:', user.email);

        // Use User Service to delete user
        this.userService.deleteUser(user.email)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              console.log('User successfully deleted from Cognito');

              // Remove from local state
              this.users = this.users.filter(u => u.userId !== user.userId);
              this.filterUsers();

              // Refresh feather icons after user deletion
              this.refreshFeatherIcons();
            },
            error: (error) => {
              console.error('Error deleting user from Cognito:', error);
              this.error = 'Failed to delete user from Cognito. Please check your permissions.';
            }
          });

      } catch (error) {
        console.error('Error deleting user:', error);
        this.error = 'Failed to delete user';
      }
    }
  }

  async updateUserRole(user: UserWithActions, newRole: string) {
    if (!this.hasUserManagementAccess()) {
      this.error = 'Access denied. Only Super Admins and Admins can update user roles.';
      return;
    }

    try {
      console.log(`Updating user ${user.email} role to ${newRole} in Cognito`);

      // Use User Service to update user role
      this.userService.updateUserRole(user.email, newRole)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // Update local state
            user.role = newRole as any;
            console.log(`Successfully updated user ${user.email} role to ${newRole} in Cognito`);
          },
          error: (error) => {
            console.error('Error updating user role in Cognito:', error);
            this.error = 'Failed to update user role in Cognito. Please check your permissions.';
          }
        });

    } catch (error) {
      console.error('Error updating user role:', error);
      this.error = 'Failed to update user role.';
    }
  }



  private hasUserManagementAccess(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  }

  canEditUser(): boolean {
    return this.hasUserManagementAccess();
  }

  canToggleUserStatus(): boolean {
    return this.hasUserManagementAccess();
  }

  canDeleteUser(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  }

  async saveUser() {
    if (!this.hasUserManagementAccess()) {
      this.error = 'Access denied. Only Super Admins and Admins can create/edit users.';
      return;
    }

    if (this.userForm.valid) {
      try {
        const formData = this.userForm.value;

        if (this.showCreateModal) {
          console.log('Creating new user in Cognito:', formData);

          // Create new user in Cognito User Pool
          const createUserRequest: CreateUserRequest = {
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            role: formData.role,
            phone: formData.phone,
            temporaryPassword: formData.temporaryPassword,
            sendWelcomeEmail: formData.sendWelcomeEmail
          };

          this.userService.createUser(createUserRequest)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (username) => {
                console.log(`Successfully created user in Cognito: ${username}`);
                this.closeModal();
                this.loadUsers();
              },
              error: (error) => {
                console.error('Error creating user in Cognito:', error);
                this.error = 'Failed to create user in Cognito. Please check your permissions and try again.';
              }
            });
        } else if (this.editingUser) {
          console.log('Updating existing user in Cognito:', formData);

          // Update existing user in Cognito User Pool
          const updateUserRequest: UpdateUserRequest = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            role: formData.role,
            phone: formData.phone
          };

          this.userService.updateUser(this.editingUser.email, updateUserRequest)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                console.log(`Successfully updated user in Cognito: ${this.editingUser?.email}`);
                this.closeModal();
                this.loadUsers();
              },
              error: (error) => {
                console.error('Error updating user in Cognito:', error);
                this.error = 'Failed to update user in Cognito. Please check your permissions and try again.';
              }
            });
        }
      } catch (error) {
        console.error('Error saving user:', error);
        this.error = 'Failed to save user';
      }
    }
  }

  closeModal() {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.editingUser = null;
    this.userForm.reset();

    // Ensure feather icons are replaced after modal closes
    this.refreshFeatherIcons();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage * this.pageSize < this.filteredUsers.length) {
      this.currentPage++;
    }
  }

  getRoleBadgeClass(role: string): string {
    const classes = {
      super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      host: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      guest: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return classes[role as keyof typeof classes] || classes.guest;
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      suspended: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      deleted: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    return classes[status as keyof typeof classes] || classes.active;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
  }

  refreshUsers() {
    this.loadUsers();
  }

  loadMoreUsers() {
    if (this.nextToken) {
      this.loadUsers();
    }
  }
}
