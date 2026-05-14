import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ModelService } from '../../../services/model.service';
import * as feather from 'feather-icons';

interface Transaction {
  id: string;
  customerName: string;
  amount: number;
  method: 'stripe' | 'paypal' | 'bank';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  date: Date;
  description: string;
}

@Component({
  selector: 'app-payment-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './payment-management.component.html'
})
export class PaymentManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  showLearning = false;
  showProcessPaymentModal = false;

  // Form
  paymentForm: FormGroup;

  // Data
  recentTransactions: Transaction[] = [];

  // Stats
  stats = {
    totalPayments: 0,
    successfulPayments: 0,
    failedPayments: 0,
    successRate: 0,
    failureRate: 0,
    totalVolume: 0
  };

  paymentMethods = {
    stripe: {
      transactions: 0,
      volume: 0
    },
    paypal: {
      transactions: 0,
      volume: 0
    },
    bank: {
      transactions: 0,
      volume: 0
    }
  };

  constructor(
    private fb: FormBuilder,
    private modelService: ModelService
  ) {
    this.paymentForm = this.fb.group({
      customerEmail: ['', [Validators.required, Validators.email]],
      amount: ['', [Validators.required, Validators.min(0)]],
      paymentMethod: ['stripe', Validators.required],
      description: ['']
    });
  }

  ngOnInit() {
    this.loadTransactions();
    this.calculateStats();
  }

  ngAfterViewInit() {
    feather.replace();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadTransactions() {
    // Mock data for now
    this.recentTransactions = [
      {
        id: 'TXN-2024-001',
        customerName: 'John Smith',
        amount: 1250.00,
        method: 'stripe',
        status: 'completed',
        date: new Date('2024-01-15'),
        description: 'Booking payment for Property A'
      },
      {
        id: 'TXN-2024-002',
        customerName: 'Sarah Johnson',
        amount: 890.50,
        method: 'paypal',
        status: 'completed',
        date: new Date('2024-01-14'),
        description: 'Booking payment for Property B'
      },
      {
        id: 'TXN-2024-003',
        customerName: 'Mike Wilson',
        amount: 2100.00,
        method: 'stripe',
        status: 'failed',
        date: new Date('2024-01-13'),
        description: 'Booking payment for Property C'
      },
      {
        id: 'TXN-2024-004',
        customerName: 'Emma Davis',
        amount: 675.25,
        method: 'bank',
        status: 'pending',
        date: new Date('2024-01-12'),
        description: 'Booking payment for Property A'
      },
      {
        id: 'TXN-2024-005',
        customerName: 'David Brown',
        amount: 450.00,
        method: 'paypal',
        status: 'refunded',
        date: new Date('2024-01-11'),
        description: 'Refund for cancelled booking'
      }
    ];

    this.calculateStats();
  }

  calculateStats() {
    this.stats.totalPayments = this.recentTransactions.length;
    this.stats.successfulPayments = this.recentTransactions.filter(t => t.status === 'completed').length;
    this.stats.failedPayments = this.recentTransactions.filter(t => t.status === 'failed').length;
    this.stats.successRate = this.stats.totalPayments > 0 ?
      Math.round((this.stats.successfulPayments / this.stats.totalPayments) * 100) : 0;
    this.stats.failureRate = this.stats.totalPayments > 0 ?
      Math.round((this.stats.failedPayments / this.stats.totalPayments) * 100) : 0;
    this.stats.totalVolume = this.recentTransactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate payment method stats
    this.paymentMethods.stripe.transactions = this.recentTransactions.filter(t => t.method === 'stripe').length;
    this.paymentMethods.stripe.volume = this.recentTransactions
      .filter(t => t.method === 'stripe' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    this.paymentMethods.paypal.transactions = this.recentTransactions.filter(t => t.method === 'paypal').length;
    this.paymentMethods.paypal.volume = this.recentTransactions
      .filter(t => t.method === 'paypal' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    this.paymentMethods.bank.transactions = this.recentTransactions.filter(t => t.method === 'bank').length;
    this.paymentMethods.bank.volume = this.recentTransactions
      .filter(t => t.method === 'bank' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getPaymentMethodIcon(method: string): string {
    const icons = {
      stripe: 'credit-card',
      paypal: 'dollar-sign',
      bank: 'smartphone'
    };
    return icons[method as keyof typeof icons] || 'credit-card';
  }

  getTransactionStatusClass(status: string): string {
    const classes = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return classes[status as keyof typeof classes] || classes.pending;
  }

  processPayment() {
    if (this.paymentForm.valid) {
      const formValue = this.paymentForm.value;
      const newTransaction: Transaction = {
        id: `TXN-2024-${String(this.recentTransactions.length + 1).padStart(3, '0')}`,
        customerName: formValue.customerEmail.split('@')[0], // Extract name from email for demo
        amount: formValue.amount,
        method: formValue.paymentMethod,
        status: 'pending',
        date: new Date(),
        description: formValue.description || 'Manual payment processing'
      };

      this.recentTransactions.unshift(newTransaction);
      this.calculateStats();
      this.showProcessPaymentModal = false;
      this.paymentForm.reset();

      // Simulate payment processing
      setTimeout(() => {
        newTransaction.status = Math.random() > 0.1 ? 'completed' : 'failed';
        this.calculateStats();
      }, 2000);
    }
  }

  viewTransaction(transaction: Transaction) {
    console.log('View transaction:', transaction);
    // Implement transaction viewing logic
  }

  refundTransaction(transaction: Transaction) {
    if (confirm('Are you sure you want to refund this transaction?')) {
      transaction.status = 'refunded';
      this.calculateStats();
    }
  }

  exportTransactions() {
    console.log('Export transactions');
    // Implement export functionality
  }

  configurePaymentMethods() {
    console.log('Configure payment methods');
    // Implement payment method configuration
  }

  viewReports() {
    console.log('View reports');
    // Implement reports viewing
  }

  manageRefunds() {
    console.log('Manage refunds');
    // Implement refund management
  }
}
