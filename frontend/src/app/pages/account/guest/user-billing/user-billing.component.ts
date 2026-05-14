import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { TabAccountComponent } from '../../../../components/tab-account/tab-account.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import { AuthService } from '../../../../services/auth.service';
import { ModelService } from '../../../../services/model.service';
import {User, UserService} from '../../../../services/user.service';

@Component({
  selector: 'app-user-billing',
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    TabAccountComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './user-billing.component.html',
  styleUrl: './user-billing.component.scss'
})
export class UserBillingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  loading = true;
  error: string | null = null;

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

  getUserFullName(): string {
    if (!this.currentUser) return 'User';
    return `${this.currentUser.firstName} ${this.currentUser.lastName}`.trim() || 'User';
  }

  hasAddress(): boolean {
    return !!(this.currentUser?.address &&
              this.currentUser.address.street &&
              this.currentUser.address.city);
  }

  getFormattedAddress(): string {
    if (!this.currentUser?.address) return 'No address provided';

    const addr = this.currentUser.address;
    let formatted = '';

    if (addr.street) formatted += addr.street;
    if (addr.city) formatted += (formatted ? ', ' : '') + addr.city;
    if (addr.state) formatted += (formatted ? ', ' : '') + addr.state;
    if (addr.country) formatted += (formatted ? ', ' : '') + addr.country;
    if (addr.zipCode) formatted += (formatted ? ' ' : '') + addr.zipCode;

    return formatted || 'No address provided';
  }
}
