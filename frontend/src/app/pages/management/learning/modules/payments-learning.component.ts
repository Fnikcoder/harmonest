import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payments-learning',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Payment Processing Learning</h1>
        <p class="text-gray-600 dark:text-gray-400">Master payment handling and financial processes</p>
      </div>
      
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div class="flex items-center space-x-3">
          <i class="fas fa-info-circle text-blue-600 dark:text-blue-400"></i>
          <div>
            <h3 class="text-lg font-medium text-blue-900 dark:text-blue-100">Coming Soon</h3>
            <p class="text-blue-700 dark:text-blue-300">Payment processing learning content is being developed and will be available soon.</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PaymentsLearningComponent {}
