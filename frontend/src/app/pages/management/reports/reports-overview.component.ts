import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-reports-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
        <p class="text-gray-600 dark:text-gray-400">Generate comprehensive reports for your property management business</p>
      </div>

      <!-- Learning Section -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div class="flex items-start space-x-3">
          <i class="fas fa-lightbulb text-blue-600 dark:text-blue-400 mt-1"></i>
          <div>
            <h3 class="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">Reports Learning Guide</h3>
            <div class="space-y-3 text-sm text-blue-700 dark:text-blue-300">
              <div>
                <h4 class="font-medium mb-1">Report Types:</h4>
                <ul class="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Financial Reports:</strong> Revenue, expenses, profit/loss statements</li>
                  <li><strong>Tax Reports:</strong> VAT, income tax, and regulatory compliance</li>
                  <li><strong>Occupancy Reports:</strong> Booking rates, seasonal trends, performance metrics</li>
                  <li><strong>Guest Reports:</strong> Demographics, satisfaction, repeat customers</li>
                </ul>
              </div>
              <div>
                <h4 class="font-medium mb-1">Best Practices:</h4>
                <ul class="list-disc list-inside space-y-1 ml-4">
                  <li>Generate reports monthly for regular business review</li>
                  <li>Use tax reports for quarterly and annual filings</li>
                  <li>Compare year-over-year data for trend analysis</li>
                  <li>Export reports in multiple formats (PDF, Excel, CSV)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Report Categories -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Financial Reports -->
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-chart-line text-green-600 dark:text-green-400 text-xl"></i>
            </div>
            <span class="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full">
              Essential
            </span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Financial Reports</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Revenue analysis, profit/loss statements, and financial performance metrics.
          </p>
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Revenue Reports</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Expense Tracking</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Profit/Loss</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
          </div>
          <a routerLink="/management/reports/financial" 
             class="w-full bg-green-600 hover:bg-green-700 text-white text-center py-2 px-4 rounded-lg font-medium transition-colors block">
            View Financial Reports
          </a>
        </div>

        <!-- Tax Reports -->
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-receipt text-blue-600 dark:text-blue-400 text-xl"></i>
            </div>
            <span class="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded-full">
              Compliance
            </span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Tax Reports</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
            VAT calculations, income tax reports, and regulatory compliance documentation.
          </p>
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">VAT Reports</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Income Tax</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Compliance</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
          </div>
          <a routerLink="/management/reports/tax" 
             class="w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg font-medium transition-colors block">
            View Tax Reports
          </a>
        </div>

        <!-- Occupancy Reports -->
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-bed text-purple-600 dark:text-purple-400 text-xl"></i>
            </div>
            <span class="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 px-2 py-1 rounded-full">
              Analytics
            </span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Occupancy Reports</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Booking rates, seasonal trends, and property performance analytics.
          </p>
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Occupancy Rates</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Seasonal Trends</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Performance</span>
              <i class="fas fa-check text-green-500"></i>
            </div>
          </div>
          <a routerLink="/management/reports/occupancy" 
             class="w-full bg-purple-600 hover:bg-purple-700 text-white text-center py-2 px-4 rounded-lg font-medium transition-colors block">
            View Occupancy Reports
          </a>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button class="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center mb-2">
              <i class="fas fa-download text-red-600 dark:text-red-400"></i>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white text-center">Export All Data</span>
          </button>

          <button class="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center mb-2">
              <i class="fas fa-calendar text-yellow-600 dark:text-yellow-400"></i>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white text-center">Monthly Summary</span>
          </button>

          <button class="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center mb-2">
              <i class="fas fa-chart-pie text-indigo-600 dark:text-indigo-400"></i>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white text-center">Custom Report</span>
          </button>

          <button class="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-2">
              <i class="fas fa-cog text-gray-600 dark:text-gray-400"></i>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white text-center">Report Settings</span>
          </button>
        </div>
      </div>

      <!-- Recent Reports -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Reports</h2>
          <button class="text-red-600 hover:text-red-700 text-sm font-medium">View All</button>
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <i class="fas fa-chart-line text-green-600 dark:text-green-400 text-sm"></i>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">Monthly Revenue Report</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Generated 2 hours ago</p>
              </div>
            </div>
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fas fa-download"></i>
            </button>
          </div>

          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <i class="fas fa-receipt text-blue-600 dark:text-blue-400 text-sm"></i>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">VAT Report Q4</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Generated yesterday</p>
              </div>
            </div>
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fas fa-download"></i>
            </button>
          </div>

          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <i class="fas fa-bed text-purple-600 dark:text-purple-400 text-sm"></i>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">Occupancy Analysis</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Generated 3 days ago</p>
              </div>
            </div>
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fas fa-download"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ReportsOverviewComponent {}
