import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ModelService } from '../../../services/model.service';
import * as feather from 'feather-icons';

interface Invoice {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  createdAt: Date;
  description: string;
}

@Component({
  selector: 'app-billing-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './billing-management.component.html'
})
export class BillingManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  showLearning = false;
  showCreateInvoiceModal = false;

  // Form
  invoiceForm: FormGroup;

  // Filters
  searchTerm = '';
  selectedStatus = '';
  selectedDateRange = '';

  // Data
  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];

  // Stats
  stats = {
    totalInvoices: 0,
    paidInvoices: 0,
    paymentRate: 0,
    outstandingAmount: 0,
    overdueInvoices: 0,
    monthlyRevenue: 0
  };

  constructor(
    private fb: FormBuilder,
    private modelService: ModelService
  ) {
    this.invoiceForm = this.fb.group({
      customerName: ['', Validators.required],
      customerEmail: ['', [Validators.required, Validators.email]],
      amount: ['', [Validators.required, Validators.min(0)]],
      dueDate: ['', Validators.required],
      description: ['']
    });
  }

  ngOnInit() {
    this.loadInvoices();
    this.calculateStats();
  }

  ngAfterViewInit() {
    feather.replace();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadInvoices() {
    // Mock data for now
    this.invoices = [
      {
        id: '1',
        number: 'INV-2024-001',
        customerName: 'John Smith',
        customerEmail: 'john@example.com',
        amount: 1250.00,
        status: 'paid',
        dueDate: new Date('2024-01-15'),
        createdAt: new Date('2024-01-01'),
        description: 'Booking for Property A - 5 nights'
      },
      {
        id: '2',
        number: 'INV-2024-002',
        customerName: 'Sarah Johnson',
        customerEmail: 'sarah@example.com',
        amount: 890.50,
        status: 'sent',
        dueDate: new Date('2024-01-20'),
        createdAt: new Date('2024-01-05'),
        description: 'Booking for Property B - 3 nights'
      },
      {
        id: '3',
        number: 'INV-2024-003',
        customerName: 'Mike Wilson',
        customerEmail: 'mike@example.com',
        amount: 2100.00,
        status: 'overdue',
        dueDate: new Date('2024-01-10'),
        createdAt: new Date('2023-12-28'),
        description: 'Booking for Property C - 7 nights'
      },
      {
        id: '4',
        number: 'INV-2024-004',
        customerName: 'Emma Davis',
        customerEmail: 'emma@example.com',
        amount: 675.25,
        status: 'draft',
        dueDate: new Date('2024-01-25'),
        createdAt: new Date('2024-01-08'),
        description: 'Booking for Property A - 2 nights'
      }
    ];

    this.filteredInvoices = [...this.invoices];
    this.calculateStats();
  }

  calculateStats() {
    this.stats.totalInvoices = this.invoices.length;
    this.stats.paidInvoices = this.invoices.filter(inv => inv.status === 'paid').length;
    this.stats.paymentRate = this.stats.totalInvoices > 0 ?
      Math.round((this.stats.paidInvoices / this.stats.totalInvoices) * 100) : 0;
    this.stats.outstandingAmount = this.invoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + inv.amount, 0);
    this.stats.overdueInvoices = this.invoices.filter(inv => inv.status === 'overdue').length;
    this.stats.monthlyRevenue = this.invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0);
  }

  filterInvoices() {
    this.filteredInvoices = this.invoices.filter(invoice => {
      const matchesSearch = !this.searchTerm ||
        invoice.number.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        invoice.customerName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        invoice.customerEmail.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.selectedStatus || invoice.status === this.selectedStatus;

      // Add date range filtering logic here if needed

      return matchesSearch && matchesStatus;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedDateRange = '';
    this.filteredInvoices = [...this.invoices];
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return classes[status as keyof typeof classes] || classes.draft;
  }

  createInvoice() {
    if (this.invoiceForm.valid) {
      const formValue = this.invoiceForm.value;
      const newInvoice: Invoice = {
        id: Date.now().toString(),
        number: `INV-2024-${String(this.invoices.length + 1).padStart(3, '0')}`,
        customerName: formValue.customerName,
        customerEmail: formValue.customerEmail,
        amount: formValue.amount,
        status: 'draft',
        dueDate: new Date(formValue.dueDate),
        createdAt: new Date(),
        description: formValue.description || ''
      };

      this.invoices.unshift(newInvoice);
      this.filteredInvoices = [...this.invoices];
      this.calculateStats();
      this.showCreateInvoiceModal = false;
      this.invoiceForm.reset();
    }
  }

  viewInvoice(invoice: Invoice) {
    console.log('View invoice:', invoice);
    // Implement invoice viewing logic
  }

  editInvoice(invoice: Invoice) {
    console.log('Edit invoice:', invoice);
    // Implement invoice editing logic
  }

  sendInvoice(invoice: Invoice) {
    console.log('Send invoice:', invoice);
    // Implement invoice sending logic
    invoice.status = 'sent';
    this.calculateStats();
  }

  deleteInvoice(invoice: Invoice) {
    if (confirm('Are you sure you want to delete this invoice?')) {
      this.invoices = this.invoices.filter(inv => inv.id !== invoice.id);
      this.filteredInvoices = this.filteredInvoices.filter(inv => inv.id !== invoice.id);
      this.calculateStats();
    }
  }

  exportInvoices() {
    console.log('Export invoices');
    // Implement export functionality
  }

  sendReminders() {
    console.log('Send reminders');
    // Implement reminder functionality
  }

  generateReport() {
    console.log('Generate report');
    // Implement report generation
  }

  configureSettings() {
    console.log('Configure settings');
    // Implement settings configuration
  }
}
