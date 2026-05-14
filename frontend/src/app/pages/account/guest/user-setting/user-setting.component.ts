import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { TabAccountComponent } from '../../../../components/tab-account/tab-account.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import { AuthService } from '../../../../services/auth.service';
import { User, UserService, UpdateUserRequest } from '../../../../services/user.service';

@Component({
  selector: 'app-user-setting',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NavbarComponent,
    TabAccountComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './user-setting.component.html',
  styleUrl: './user-setting.component.scss'
})
export class UserSettingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  loading = true;
  error: string | null = null;
  saving = false;

  profileForm: FormGroup;
  contactForm: FormGroup;
  passwordForm: FormGroup;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private fb: FormBuilder
  ) {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      dateOfBirth: [''],
      nationality: [''],
      preferredLanguage: ['en'],
      timezone: ['UTC'],
      description: ['']
    });

    this.contactForm = this.fb.group({
      street: [''],
      city: [''],
      state: [''],
      country: [''],
      zipCode: ['']
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    this.loadUserData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    return null;
  }

  private loadUserData() {
    this.loading = true;
    this.error = null;

    // Get current authenticated user
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (authState) => {
          if (authState.isAuthenticated && authState.user) {
            this.loadUserProfile(authState.user.email);
          } else {
            this.loading = false;
            this.error = 'User not authenticated';
          }
        },
        error: (error) => {
          console.error('Error getting auth state:', error);
          this.loading = false;
          this.error = 'Failed to load user data';
        }
      });
  }

  private loadUserProfile(email: string) {
    this.userService.getUserByEmail(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.populateForms();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading user profile:', error);
          this.loading = false;
          this.error = 'Failed to load user profile';
        }
      });
  }

  private populateForms() {
    if (!this.currentUser) return;

    // Populate profile form
    this.profileForm.patchValue({
      firstName: this.currentUser?.firstName || '',
      lastName: this.currentUser?.lastName || '',
      email: this.currentUser.email || '',
      phone: this.currentUser.phone || '',
      dateOfBirth: this.currentUser?.dateOfBirth || '',
      nationality: this.currentUser?.nationality || '',
      preferredLanguage: this.currentUser?.preferredLanguage || 'en',
      timezone: this.currentUser?.timezone || 'UTC'
    });

    // Populate contact form
    this.contactForm.patchValue({
      street: this.currentUser.address?.street || '',
      city: this.currentUser.address?.city || '',
      state: this.currentUser.address?.state || '',
      country: this.currentUser.address?.country || '',
      zipCode: this.currentUser.address?.zipCode || ''
    });
  }

  onSaveProfile() {
    if (this.profileForm.invalid || !this.currentUser) return;

    this.saving = true;
    const formData = this.profileForm.value;

    const updates = {
      email: formData.email,
      phone: formData.phone,
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth,
      nationality: formData.nationality,
      preferredLanguage: formData.preferredLanguage,
      timezone: formData.timezone,
      updatedAt: new Date().toISOString()
    };

    // Update user attributes in Cognito
    if (!this.currentUser?.email) {
      this.saving = false;
      console.error('No current user email found');
      return;
    }

    const cognitoUpdates: UpdateUserRequest = {
      firstName: updates.firstName,
      lastName: updates.lastName,
      phone: updates.phone
    };

    // Note: Email updates require verification and are handled separately
    // If email is being updated, it would require additional verification steps

    // Remove undefined values
    Object.keys(cognitoUpdates).forEach(key => {
      if (cognitoUpdates[key as keyof UpdateUserRequest] === undefined) {
        delete cognitoUpdates[key as keyof UpdateUserRequest];
      }
    });

    this.userService.updateUser(this.currentUser.email, cognitoUpdates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Update local state
          if (this.currentUser) {
            this.currentUser = { ...this.currentUser, ...updates };
          }
          this.saving = false;
          console.log('Profile updated successfully in Cognito');

          // Refresh auth state to get updated user data
          this.authService.refreshUserData();
        },
        error: (error: any) => {
          console.error('Error updating profile in Cognito:', error);
          this.saving = false;
          this.error = 'Failed to update profile. Please try again.';
        }
      });
  }

  onSaveContact() {
    if (this.contactForm.invalid || !this.currentUser) return;

    this.saving = true;
    const formData = this.contactForm.value;

    const updates = {
      address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        zipCode: formData.zipCode
      },
      updatedAt: new Date().toISOString()
    };

    // Note: Contact information (address) is not stored in Cognito attributes
    // In a real implementation, this would be stored in DynamoDB user preferences
    // For now, just update locally
    if (this.currentUser) {
      this.currentUser = { ...this.currentUser, ...updates };
      this.saving = false;
      console.log('Contact info updated successfully (local update)');
      console.log('Note: Address data should be stored in DynamoDB preferences table');
    } else {
      this.saving = false;
      console.error('No current user to update');
    }
  }

  onChangePassword() {
    if (this.passwordForm.invalid) return;

    this.saving = true;
    const formData = this.passwordForm.value;

    // Use AuthService to change password
    this.authService.changePassword(formData.currentPassword, formData.newPassword)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.passwordForm.reset();
          // Show success message
        },
        error: (error) => {
          console.error('Error changing password:', error);
          this.saving = false;
          this.error = 'Failed to change password';
        }
      });
  }

  onUpdateEmail() {
    if (!this.currentUser?.email) {
      console.error('No current user email found');
      return;
    }

    const newEmail = this.profileForm.get('email')?.value;
    if (!newEmail || newEmail === this.currentUser.email) {
      console.log('Email unchanged or empty');
      return;
    }

    this.saving = true;

    // Update email in Cognito (this will require verification)
    this.userService.updateUser(this.currentUser.email, { email: newEmail })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          console.log('Email update initiated. Verification required.');
          // Show message to user about email verification
          alert('Email update initiated. Please check your new email for verification instructions.');
        },
        error: (error: any) => {
          console.error('Error updating email:', error);
          this.saving = false;
          this.error = 'Failed to update email. Please try again.';
        }
      });
  }

  onDeleteAccount() {
    const confirmMessage = 'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.';

    if (confirm(confirmMessage)) {
      this.saving = true;

      // Import deleteUser from aws-amplify/auth
      import('aws-amplify/auth').then(({ deleteUser }) => {
        return deleteUser();
      }).then(() => {
        console.log('Account deleted successfully');
        // Sign out and redirect to home page
        this.authService.signOut().subscribe({
          next: () => {
            console.log('User signed out after account deletion');
          },
          error: (error: any) => {
            console.error('Error signing out after deletion:', error);
            // Force navigation even if sign out fails
            window.location.href = '/';
          }
        });
      }).catch((error: any) => {
        console.error('Error deleting account:', error);
        this.saving = false;
        this.error = 'Failed to delete account. Please try again or contact support.';
      });
    }
  }
}
