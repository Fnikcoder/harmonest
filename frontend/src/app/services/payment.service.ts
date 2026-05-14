import { Injectable } from '@angular/core';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { loadScript } from '@paypal/paypal-js';
import { Observable, from, throwError, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
  paymentMethod?: 'stripe' | 'paypal' | 'bank';
}

export interface StripePaymentData {
  cardholderName: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;
  private paypalLoaded = false;

  // Payment processing state
  private paymentProcessingSubject = new BehaviorSubject<boolean>(false);
  paymentProcessing$ = this.paymentProcessingSubject.asObservable();

  constructor() {
    this.initializeStripe();
  }

  private async initializeStripe(): Promise<void> {
    try {
      this.stripe = await loadStripe(environment.stripe.publishableKey);

      if (this.stripe) {
        this.elements = this.stripe.elements();
      }
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
    }
  }

  async createStripeCardElement(elementId: string): Promise<void> {
    if (!this.elements) {
      throw new Error('Stripe elements not initialized');
    }

    // Destroy existing card element if it exists
    if (this.cardElement) {
      this.cardElement.destroy();
      this.cardElement = null;
    }

    this.cardElement = this.elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#424770',
          fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
          fontSmoothing: 'antialiased',
          '::placeholder': {
            color: '#aab7c4',
          },
        },
        invalid: {
          color: '#9e2146',
        },
      },
      hidePostalCode: false,
    });

    try {
      this.cardElement.mount(`#${elementId}`);
    } catch (error) {
      console.error('Error mounting Stripe card element:', error);
      throw error;
    }
  }

  async processStripePayment(
    amount: number,
    currency: string = 'usd',
    paymentData: StripePaymentData
  ): Promise<PaymentResult> {
    if (!this.stripe || !this.cardElement) {
      return { success: false, error: 'Stripe not initialized' };
    }

    this.paymentProcessingSubject.next(true);

    try {
      // Create payment method
      const { error: paymentMethodError, paymentMethod } = await this.stripe.createPaymentMethod({
        type: 'card',
        card: this.cardElement,
        billing_details: {
          name: paymentData.cardholderName,
          address: {
            line1: paymentData.billingAddress.street,
            city: paymentData.billingAddress.city,
            state: paymentData.billingAddress.state,
            postal_code: paymentData.billingAddress.zipCode,
            country: paymentData.billingAddress.country,
          },
        },
      });

      if (paymentMethodError) {
        this.paymentProcessingSubject.next(false);
        return { success: false, error: paymentMethodError.message };
      }

      // In a real application, you would send the payment method to your backend
      // and create a payment intent there for security
      const paymentResult = await this.createPaymentIntent(amount, currency, paymentMethod!.id);

      this.paymentProcessingSubject.next(false);
      return paymentResult;

    } catch (error) {
      this.paymentProcessingSubject.next(false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      };
    }
  }

  private async createPaymentIntent(amount: number, currency: string, paymentMethodId: string): Promise<PaymentResult> {
    // This should be done on your backend for security
    // For demo purposes, we'll simulate a successful payment
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate payment processing
        const success = Math.random() > 0.1; // 90% success rate for demo

        if (success) {
          resolve({
            success: true,
            paymentId: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            paymentMethod: 'stripe'
          });
        } else {
          resolve({
            success: false,
            error: 'Payment was declined. Please try a different card.'
          });
        }
      }, 2000);
    });
  }

  async initializePayPal(containerId: string, amount: number, currency: string = 'USD'): Promise<void> {
    if (this.paypalLoaded) return;

    try {
      const paypal = await loadScript({
        clientId: environment.paypal.clientId,
        currency: currency
      });

      if (paypal && paypal.Buttons) {
        await paypal.Buttons({
          createOrder: (data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{
                amount: {
                  value: amount.toFixed(2),
                  currency_code: currency
                }
              }]
            });
          },
          onApprove: async (data: any, actions: any) => {
            this.paymentProcessingSubject.next(true);

            try {
              const order = await actions.order.capture();
              this.paymentProcessingSubject.next(false);

              // Handle successful payment
              this.handlePayPalSuccess(order);
            } catch (error) {
              this.paymentProcessingSubject.next(false);
              this.handlePayPalError(error);
            }
          },
          onError: (error: any) => {
            this.paymentProcessingSubject.next(false);
            this.handlePayPalError(error);
          },
          onCancel: () => {
            this.paymentProcessingSubject.next(false);
            console.log('PayPal payment cancelled');
          }
        }).render(`#${containerId}`);

        this.paypalLoaded = true;
      }
    } catch (error) {
      console.error('Failed to initialize PayPal:', error);
      throw error;
    }
  }

  private handlePayPalSuccess(order: any): void {
    // Emit success event or handle via callback
    console.log('PayPal payment successful:', order);
    // You can emit an event or use a callback here
  }

  private handlePayPalError(error: any): void {
    console.error('PayPal payment error:', error);
    // Handle error - show message to user
  }

  processBankTransfer(amount: number): Observable<PaymentResult> {
    this.paymentProcessingSubject.next(true);

    // Simulate bank transfer processing
    return from(new Promise<PaymentResult>((resolve) => {
      setTimeout(() => {
        this.paymentProcessingSubject.next(false);
        resolve({
          success: true,
          paymentId: `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          paymentMethod: 'bank'
        });
      }, 1500);
    }));
  }

  validateCardElement(): Observable<boolean> {
    if (!this.cardElement) {
      return throwError(() => new Error('Card element not initialized'));
    }

    return from(new Promise<boolean>((resolve) => {
      this.cardElement!.on('change', (event) => {
        resolve(event.complete && !event.error);
      });
    }));
  }

  destroyStripeElements(): void {
    if (this.cardElement) {
      try {
        this.cardElement.destroy();
      } catch (error) {
        console.warn('Error destroying Stripe card element:', error);
      }
      this.cardElement = null;
    }
  }

  isStripeReady(): boolean {
    return this.stripe !== null && this.elements !== null;
  }

  isPayPalReady(): boolean {
    return this.paypalLoaded;
  }

  resetPayPalState(): void {
    this.paypalLoaded = false;
  }
}
