import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { TabAccountComponent } from '../../../../components/tab-account/tab-account.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import { AuthService } from '../../../../services/auth.service';
import { ModelService } from '../../../../services/model.service';
import { User } from '../../../../interfaces/user.interface';

@Component({
  selector: 'app-user-payment',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    TabAccountComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './user-payment.component.html',
  styleUrl: './user-payment.component.scss'
})
export class UserPaymentComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  loading = true;
  error: string | null = null;
  isOpen: boolean = false;

  constructor(
    private authService: AuthService,
    private modelService: ModelService
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
    // ========== DYNAMODB USER PROFILE LOADING - DISABLED ==========
    // The following code was used to load user profile from DynamoDB.
    // Since we're now using only AWS Cognito for user management, this is disabled.
    // User profile data should now come from AWS Cognito User Pool attributes.

    console.log('DynamoDB user profile loading is disabled. User data should come from Cognito.');

    // For now, set user to null and stop loading
    this.currentUser = null;
    this.loading = false;

    // TODO: Implement Cognito user profile loading
    // Example: Get user data from AuthService which already has Cognito user info
    // this.currentUser = this.authService.getCurrentUser();

    // Previous DynamoDB code (commented out):
    // this.modelService.getUserByEmail(email)
    //   .pipe(takeUntil(this.destroy$))
    //   .subscribe({
    //     next: (user) => {
    //       this.currentUser = user;
    //       this.loading = false;
    //     },
    //     error: (error) => {
    //       console.error('Error loading user profile:', error);
    //       this.loading = false;
    //       this.error = 'Failed to load user profile';
    //     }
    //   });
  }

  showModal() {
    this.isOpen = !this.isOpen;
  }

  getPaymentMethodImage(brand: string): string {
    const brandMap: { [key: string]: string } = {
      'visa': 'assets/images/payments/visa.jpg',
      'mastercard': 'assets/images/payments/mastercard.jpg',
      'amex': 'assets/images/payments/american-express.jpg',
      'discover': 'assets/images/payments/discover.jpg'
    };
    return brandMap[brand.toLowerCase()] || 'assets/images/payments/default-card.jpg';
  }

  getPaymentMethodName(method: any): string {
    if (method.type === 'credit_card' || method.type === 'debit_card') {
      const cardType = method.type === 'credit_card' ? 'Credit' : 'Debit';
      const brand = method.card?.brand || 'Card';
      const last4 = method.card?.last4 || '****';
      return `${brand.charAt(0).toUpperCase() + brand.slice(1)} ${cardType} ending in ${last4}`;
    } else if (method.type === 'paypal') {
      return `PayPal (${method.wallet?.email || 'Account'})`;
    } else if (method.type === 'bank_account') {
      return 'Bank Account';
    }
    return 'Payment Method';
  }

  getExpiryDate(method: any): string {
    if (method.card?.expiryMonth && method.card?.expiryYear) {
      return `Expires ${method.card.expiryMonth.toString().padStart(2, '0')}/${method.card.expiryYear}`;
    }
    return '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  removePaymentMethod(methodId: string) {
    // TODO: Implement payment method removal
    console.log('Remove payment method:', methodId);
  }
}
