import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface FinancialData {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  bookings: number;
  averageRate: number;
  occupancyRate: number;
}

interface ExpenseCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-financial-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Financial Reports</h1>
          <p class="text-gray-600 dark:text-gray-400">Revenue analysis and financial performance</p>
        </div>
        <div class="flex space-x-3">
          <button (click)="showLearning = !showLearning"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <i class="fas fa-graduation-cap mr-2"></i>
            Learning Guide
          </button>
          <button (click)="exportReport()"
                  class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <i class="fas fa-download mr-2"></i>
            Export Report
          </button>
        </div>
      </div>

      <!-- Learning Section -->
      <div *ngIf="showLearning" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div class="flex items-start space-x-3">
          <i class="fas fa-lightbulb text-blue-600 dark:text-blue-400 mt-1"></i>
          <div>
            <h3 class="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">Financial Reports Guide</h3>
            <div class="space-y-3 text-sm text-blue-700 dark:text-blue-300">
              <div>
                <h4 class="font-medium mb-1">Key Financial Metrics:</h4>
                <ul class="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Revenue:</strong> Total income from bookings and additional services</li>
                  <li><strong>Gross Profit:</strong> Revenue minus direct costs (cleaning, utilities)</li>
                  <li><strong>Net Profit:</strong> Gross profit minus all expenses (marketing, maintenance)</li>
                  <li><strong>RevPAR:</strong> Revenue per Available Room - key performance indicator</li>
                </ul>
              </div>
              <div>
                <h4 class="font-medium mb-1">Report Analysis Tips:</h4>
                <ul class="list-disc list-inside space-y-1 ml-4">
                  <li>Compare month-over-month and year-over-year trends</li>
                  <li>Monitor seasonal patterns for better pricing strategies</li>
                  <li>Track expense ratios to identify cost optimization opportunities</li>
                  <li>Use profit margins to evaluate property performance</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Period</label>
            <select [(ngModel)]="selectedPeriod"
                    (change)="loadFinancialData()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="last_6_months">Last 6 Months</option>
              <option value="last_12_months">Last 12 Months</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Property</label>
            <select [(ngModel)]="selectedProperty"
                    (change)="loadFinancialData()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="">All Properties</option>
              <option value="property1">Downtown Berlin Apartments</option>
              <option value="property2">City Center Suites</option>
              <option value="property3">Riverside Lofts</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Currency</label>
            <select [(ngModel)]="selectedCurrency"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
          <div class="flex items-end">
            <button (click)="refreshData()"
                    class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
              <i class="fas fa-sync-alt mr-2"></i>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalRevenue) }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-euro-sign text-green-600 dark:text-green-400"></i>
            </div>
          </div>
          <div class="mt-4 flex items-center text-sm">
            <span class="text-green-600 dark:text-green-400 font-medium">+12.5%</span>
            <span class="text-gray-600 dark:text-gray-400 ml-2">vs last period</span>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalExpenses) }}</p>
            </div>
            <div class="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-receipt text-red-600 dark:text-red-400"></i>
            </div>
          </div>
          <div class="mt-4 flex items-center text-sm">
            <span class="text-red-600 dark:text-red-400 font-medium">+8.2%</span>
            <span class="text-gray-600 dark:text-gray-400 ml-2">vs last period</span>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Net Profit</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(netProfit) }}</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-chart-line text-blue-600 dark:text-blue-400"></i>
            </div>
          </div>
          <div class="mt-4 flex items-center text-sm">
            <span class="text-green-600 dark:text-green-400 font-medium">+18.7%</span>
            <span class="text-gray-600 dark:text-gray-400 ml-2">vs last period</span>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Profit Margin</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ profitMargin }}%</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-percentage text-purple-600 dark:text-purple-400"></i>
            </div>
          </div>
          <div class="mt-4 flex items-center text-sm">
            <span class="text-green-600 dark:text-green-400 font-medium">+2.1%</span>
            <span class="text-gray-600 dark:text-gray-400 ml-2">vs last period</span>
          </div>
        </div>
      </div>

      <!-- Charts and Tables -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Revenue Trend Chart -->
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Revenue Trend</h3>
            <div class="flex space-x-2">
              <button (click)="chartType = 'line'"
                      [class.bg-red-600]="chartType === 'line'"
                      [class.text-white]="chartType === 'line'"
                      class="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600">
                Line
              </button>
              <button (click)="chartType = 'bar'"
                      [class.bg-red-600]="chartType === 'bar'"
                      [class.text-white]="chartType === 'bar'"
                      class="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600">
                Bar
              </button>
            </div>
          </div>

          <!-- Chart Placeholder -->
          <div class="h-64 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div class="text-center">
              <i class="fas fa-chart-line text-gray-400 text-4xl mb-2"></i>
              <p class="text-gray-500 dark:text-gray-400">Revenue trend chart</p>
              <p class="text-sm text-gray-400 dark:text-gray-500">Chart integration coming soon</p>
            </div>
          </div>
        </div>

        <!-- Expense Breakdown -->
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Expense Breakdown</h3>

          <div class="space-y-4">
            <div *ngFor="let category of expenseCategories" class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-4 h-4 rounded" [style.background-color]="category.color"></div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ category.name }}</span>
              </div>
              <div class="text-right">
                <div class="text-sm font-medium text-gray-900 dark:text-white">{{ formatCurrency(category.amount) }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ category.percentage }}%</div>
              </div>
            </div>
          </div>

          <!-- Pie Chart Placeholder -->
          <div class="mt-6 h-32 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div class="text-center">
              <i class="fas fa-chart-pie text-gray-400 text-2xl mb-1"></i>
              <p class="text-xs text-gray-400 dark:text-gray-500">Pie chart coming soon</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Financial Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Detailed Financial Data</h3>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Period
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Revenue
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Expenses
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Profit
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Bookings
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg Rate
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Occupancy
                </th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr *ngFor="let data of financialData" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {{ data.period }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ formatCurrency(data.revenue) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ formatCurrency(data.expenses) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span [class.text-green-600]="data.profit > 0"
                        [class.text-red-600]="data.profit < 0"
                        [class.dark:text-green-400]="data.profit > 0"
                        [class.dark:text-red-400]="data.profit < 0">
                    {{ formatCurrency(data.profit) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ data.bookings }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ formatCurrency(data.averageRate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ data.occupancyRate }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Export Options -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export Options</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button (click)="exportToPDF()"
                  class="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center mb-2">
              <i class="fas fa-file-pdf text-red-600 dark:text-red-400"></i>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white text-center">Export to PDF</span>
          </button>

          <button (click)="exportToExcel()"
                  class="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mb-2">
              <i class="fas fa-file-excel text-green-600 dark:text-green-400"></i>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white text-center">Export to Excel</span>
          </button>

          <button (click)="exportToCSV()"
                  class="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-2">
              <i class="fas fa-file-csv text-blue-600 dark:text-blue-400"></i>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white text-center">Export to CSV</span>
          </button>

          <button (click)="scheduleReport()"
                  class="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-2">
              <i class="fas fa-clock text-purple-600 dark:text-purple-400"></i>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white text-center">Schedule Report</span>
          </button>
        </div>
      </div>
    </div>
  `
})
export class FinancialReportsComponent implements OnInit {
  showLearning = false;

  selectedPeriod = 'last_30_days';
  selectedProperty = '';
  selectedCurrency = 'EUR';
  chartType = 'line';

  // Financial metrics
  totalRevenue = 45250.00;
  totalExpenses = 28750.00;
  netProfit = 16500.00;
  profitMargin = 36.5;

  financialData: FinancialData[] = [];
  expenseCategories: ExpenseCategory[] = [];

  ngOnInit() {
    this.loadFinancialData();
    this.loadExpenseCategories();
  }

  loadFinancialData() {
    // Mock financial data - replace with actual API call
    this.financialData = [
      {
        period: 'January 2024',
        revenue: 15250.00,
        expenses: 9750.00,
        profit: 5500.00,
        bookings: 45,
        averageRate: 125.50,
        occupancyRate: 78
      },
      {
        period: 'February 2024',
        revenue: 14800.00,
        expenses: 9200.00,
        profit: 5600.00,
        bookings: 42,
        averageRate: 130.20,
        occupancyRate: 75
      },
      {
        period: 'March 2024',
        revenue: 15200.00,
        expenses: 9800.00,
        profit: 5400.00,
        bookings: 48,
        averageRate: 128.75,
        occupancyRate: 82
      }
    ];
  }

  loadExpenseCategories() {
    this.expenseCategories = [
      {
        name: 'Cleaning & Maintenance',
        amount: 8500.00,
        percentage: 29.6,
        color: '#EF4444'
      },
      {
        name: 'Utilities',
        amount: 6200.00,
        percentage: 21.6,
        color: '#F59E0B'
      },
      {
        name: 'Marketing & Advertising',
        amount: 4800.00,
        percentage: 16.7,
        color: '#10B981'
      },
      {
        name: 'Insurance',
        amount: 3200.00,
        percentage: 11.1,
        color: '#3B82F6'
      },
      {
        name: 'Property Management',
        amount: 2850.00,
        percentage: 9.9,
        color: '#8B5CF6'
      },
      {
        name: 'Other',
        amount: 3200.00,
        percentage: 11.1,
        color: '#6B7280'
      }
    ];
  }

  refreshData() {
    this.loadFinancialData();
    this.loadExpenseCategories();
  }

  formatCurrency(amount: number): string {
    const symbol = this.selectedCurrency === 'EUR' ? '€' :
                   this.selectedCurrency === 'USD' ? '$' : '£';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  exportReport() {
    console.log('Exporting financial report...');
  }

  exportToPDF() {
    console.log('Exporting to PDF...');
  }

  exportToExcel() {
    console.log('Exporting to Excel...');
  }

  exportToCSV() {
    console.log('Exporting to CSV...');
  }

  scheduleReport() {
    console.log('Scheduling report...');
  }
}
