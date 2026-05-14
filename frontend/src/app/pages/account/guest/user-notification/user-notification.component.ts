import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { TabAccountComponent } from '../../../../components/tab-account/tab-account.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import { AuthService } from '../../../../services/auth.service';
import {User, UserService} from '../../../../services/user.service';

@Component({
  selector: 'app-user-notification',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    TabAccountComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './user-notification.component.html',
  styleUrl: './user-notification.component.scss'
})
export class UserNotificationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  loading = true;
  error: string | null = null;
  saving = false;

  constructor(
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.loadUserData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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
        next: (user: User | null) => {
          this.currentUser = user;
          this.loading = false;
        },
        error: (error: any) => {
          console.error('Error loading user profile:', error);
          this.loading = false;
          this.error = 'Failed to load user profile';
        }
      });
  }

  updateNotificationPreference(category: string, setting: string, value: boolean) {
    if (!this.currentUser) return;

    this.saving = true;

    // Update local state immediately for better UX
    if (this.currentUser.preferences?.notifications) {
      (this.currentUser.preferences.notifications as any)[setting] = value;
    }

    // For now, just update locally since notification preferences are not stored in Cognito attributes
    // In a real implementation, you would store these in DynamoDB user preferences table
    // using the userId as the key: USER#<userId> -> PREFERENCES

    // TODO: Implement DynamoDB preferences storage
    // const updates = {
    //   [`preferences.notifications.${setting}`]: value,
    //   updatedAt: new Date().toISOString()
    // };

    // Simulate successful update
    setTimeout(() => {
      this.saving = false;
      console.log(`Notification preference updated: ${setting} = ${value}`);
      console.log('Note: This should be stored in DynamoDB preferences table with userId:', this.currentUser?.userId);
    }, 500);
  }
}
