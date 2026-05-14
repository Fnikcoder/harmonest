import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BookingService } from '../../services/booking.service';
import { PaymentService, PaymentResult, StripePaymentData } from '../../services/payment.service';
import { BookingData } from '../../interfaces/booking.interface';
import { Subject, takeUntil } from 'rxjs';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-booking-step-five',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './booking-step-five.component.html',
  styleUrl: './booking-step-five.component.scss'
})
export class BookingStepFiveComponent implements OnInit, OnDestroy, AfterViewInit {
  paymentForm: FormGroup;
  bookingData: Partial<BookingData> = {};
  isProcessing = false;
  selectedPaymentMethod = 'card';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private paymentService: PaymentService
  ) {
    this.paymentForm = this.fb.group({
      paymentMethod: ['card', Validators.required],
      cardholderName: ['', Validators.required],
      billingAddress: this.fb.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required],
        zipCode: ['', Validators.required],
        country: ['US', Validators.required]
      }),
      saveCard: [false],
      agreeToTerms: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {
    this.bookingService.bookingData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.bookingData = data;
        // Pre-fill cardholder name with guest name
        if (data.guestDetails?.firstName && data.guestDetails?.lastName) {
          this.paymentForm.patchValue({
            cardholderName: `${data.guestDetails.firstName} ${data.guestDetails.lastName}`
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Clean up Stripe elements
    this.paymentService.destroyStripeElements();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      feather.replace();
      this.initializePaymentMethods();
    }, 100);
  }

  private async initializePaymentMethods(): Promise<void> {
    if (this.selectedPaymentMethod === 'card') {
      await this.initializeStripe();
    } else if (this.selectedPaymentMethod === 'paypal') {
      await this.initializePayPal();
    }
  }

  private async initializeStripe(): Promise<void> {
    try {
      // First destroy any existing Stripe elements
      this.paymentService.destroyStripeElements();

      // Check if the element exists in DOM
      const stripeElement = document.getElementById('stripe-card-element');
      if (!stripeElement) {
        console.warn('Stripe card element not found in DOM');
        return;
      }

      // Clear the element content
      stripeElement.innerHTML = '';

      if (this.paymentService.isStripeReady()) {
        await this.paymentService.createStripeCardElement('stripe-card-element');
      } else {
        // If Stripe isn't ready, wait and retry
        setTimeout(async () => {
          if (this.paymentService.isStripeReady()) {
            await this.paymentService.createStripeCardElement('stripe-card-element');
          }
        }, 500);
      }
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
    }
  }

  private async initializePayPal(): Promise<void> {
    try {
      // Check if the PayPal container exists in DOM
      const paypalContainer = document.getElementById('paypal-button-container');
      if (!paypalContainer) {
        console.warn('PayPal button container not found in DOM');
        return;
      }

      // Clear the container content
      paypalContainer.innerHTML = '';

      const amount = this.totalAmount;
      await this.paymentService.initializePayPal('paypal-button-container', amount);
    } catch (error) {
      console.error('Failed to initialize PayPal:', error);
    }
  }

  private cleanupPaymentMethods(): void {
    // Clean up Stripe elements
    this.paymentService.destroyStripeElements();

    // Clean up PayPal buttons
    const paypalContainer = document.getElementById('paypal-button-container');
    if (paypalContainer) {
      paypalContainer.innerHTML = '';
    }

    // Reset PayPal loaded state in service
    this.paymentService.resetPayPalState();
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  async onPaymentMethodChange(method: string): Promise<void> {
    // Clean up previous payment method
    this.cleanupPaymentMethods();

    this.selectedPaymentMethod = method;
    this.paymentForm.patchValue({ paymentMethod: method });

    // Update validators based on payment method
    if (method === 'card') {
      this.enableCardValidators();
      // Wait a bit for DOM to update, then initialize Stripe
      setTimeout(async () => {
        await this.initializeStripe();
      }, 100);
    } else if (method === 'paypal') {
      this.disableCardValidators();
      // Wait a bit for DOM to update, then initialize PayPal
      setTimeout(async () => {
        await this.initializePayPal();
      }, 100);
    } else {
      this.disableCardValidators();
    }
  }

  private enableCardValidators(): void {
    this.paymentForm.get('cardholderName')?.setValidators([Validators.required]);
    this.paymentForm.get('billingAddress.street')?.setValidators([Validators.required]);
    this.paymentForm.get('billingAddress.city')?.setValidators([Validators.required]);
    this.paymentForm.get('billingAddress.state')?.setValidators([Validators.required]);
    this.paymentForm.get('billingAddress.zipCode')?.setValidators([Validators.required]);
    this.paymentForm.get('billingAddress.country')?.setValidators([Validators.required]);
  }

  private disableCardValidators(): void {
    this.paymentForm.get('cardholderName')?.clearValidators();
    this.paymentForm.get('billingAddress.street')?.clearValidators();
    this.paymentForm.get('billingAddress.city')?.clearValidators();
    this.paymentForm.get('billingAddress.state')?.clearValidators();
    this.paymentForm.get('billingAddress.zipCode')?.clearValidators();
    this.paymentForm.get('billingAddress.country')?.clearValidators();
  }



  async onProcessPayment(): Promise<void> {
    if (!this.paymentForm.valid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    this.isProcessing = true;

    try {
      let paymentResult: PaymentResult;

      switch (this.selectedPaymentMethod) {
        case 'card':
          paymentResult = await this.processStripePayment();
          break;
        case 'paypal':
          // PayPal handles its own flow, so we just wait for the callback
          return;
        case 'bank':
          paymentResult = await this.processBankTransfer();
          break;
        default:
          throw new Error('Invalid payment method');
      }

      this.handlePaymentResult(paymentResult);

    } catch (error) {
      this.isProcessing = false;
      console.error('Payment processing error:', error);
      // Show error message to user
    }
  }

  private async processStripePayment(): Promise<PaymentResult> {
    const paymentData: StripePaymentData = {
      cardholderName: this.paymentForm.get('cardholderName')?.value || '',
      billingAddress: this.paymentForm.get('billingAddress')?.value || {}
    };

    return await this.paymentService.processStripePayment(
      this.totalAmount,
      'usd',
      paymentData
    );
  }

  private async processBankTransfer(): Promise<PaymentResult> {
    return new Promise((resolve) => {
      this.paymentService.processBankTransfer(this.totalAmount).subscribe({
        next: (result) => resolve(result),
        error: (error) => resolve({ success: false, error: error.message })
      });
    });
  }

  private handlePaymentResult(result: PaymentResult): void {
    this.isProcessing = false;

    if (result.success) {
      // Store payment result in booking data
      this.bookingService.updatePaymentResult(result);

      // Mark step 5 as completed and move to confirmation
      this.bookingService.markStepCompleted(5);
      this.bookingService.nextStep();
    } else {
      // Show error message
      console.error('Payment failed:', result.error);
      // You can show a toast or error message here
    }
  }

  onPrevious(): void {
    this.bookingService.previousStep();
  }

  get totalAmount(): number {
    return this.bookingData.total || 0;
  }

  get isFormValid(): boolean {
    return this.paymentForm.valid;
  }

  protected readonly Date = Date;
}
