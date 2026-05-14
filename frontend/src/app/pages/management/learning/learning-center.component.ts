import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, AuthUser } from '../../../services/auth.service';

interface LearningModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  topics: string[];
  requiredRoles: string[];
}

@Component({
  selector: 'app-learning-center',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Learning Center</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Master your property management skills with our comprehensive guides and tutorials.
          Learn best practices, tips, and advanced techniques to maximize your success.
        </p>
      </div>

      <!-- Quick Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <i class="fas fa-book text-blue-600 dark:text-blue-400 text-xl"></i>
          </div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white">{{ availableModules.length }}</h3>
          <p class="text-gray-600 dark:text-gray-400">Learning Modules</p>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <div class="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <i class="fas fa-clock text-green-600 dark:text-green-400 text-xl"></i>
          </div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white">2-15</h3>
          <p class="text-gray-600 dark:text-gray-400">Minutes per Module</p>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <i class="fas fa-star text-yellow-600 dark:text-yellow-400 text-xl"></i>
          </div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white">{{ currentUser?.role | titlecase }}</h3>
          <p class="text-gray-600 dark:text-gray-400">Your Access Level</p>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <i class="fas fa-graduation-cap text-purple-600 dark:text-purple-400 text-xl"></i>
          </div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white">Free</h3>
          <p class="text-gray-600 dark:text-gray-400">All Content</p>
        </div>
      </div>

      <!-- Learning Modules Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div *ngFor="let module of availableModules" 
             class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
          
          <!-- Module Header -->
          <div class="p-6 pb-4">
            <div class="flex items-start justify-between mb-4">
              <div class="w-12 h-12 rounded-lg flex items-center justify-center"
                   [ngClass]="getModuleIconClass(module.difficulty)">
                <i [class]="module.icon" class="text-xl"></i>
              </div>
              <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                    [ngClass]="getDifficultyBadgeClass(module.difficulty)">
                {{ module.difficulty | titlecase }}
              </span>
            </div>
            
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ module.title }}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">{{ module.description }}</p>
            
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
              <i class="fas fa-clock mr-2"></i>
              {{ module.duration }}
            </div>
          </div>

          <!-- Topics -->
          <div class="px-6 pb-4">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">What you'll learn:</h4>
            <ul class="space-y-1">
              <li *ngFor="let topic of module.topics.slice(0, 3)" 
                  class="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                <i class="fas fa-check text-green-500 mr-2 text-xs"></i>
                {{ topic }}
              </li>
              <li *ngIf="module.topics.length > 3" 
                  class="text-sm text-gray-500 dark:text-gray-500">
                +{{ module.topics.length - 3 }} more topics
              </li>
            </ul>
          </div>

          <!-- Action -->
          <div class="px-6 pb-6">
            <a [routerLink]="['/management/learning', module.route]" 
               class="w-full bg-red-600 hover:bg-red-700 text-white text-center py-2 px-4 rounded-lg font-medium transition-colors block">
              Start Learning
            </a>
          </div>
        </div>
      </div>

      <!-- Getting Started Section -->
      <div class="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-8 text-white">
        <div class="max-w-3xl">
          <h2 class="text-2xl font-bold mb-4">New to Property Management?</h2>
          <p class="text-red-100 mb-6">
            Start with our beginner-friendly modules to learn the fundamentals of managing properties, 
            handling bookings, and providing excellent guest experiences.
          </p>
          <div class="flex flex-wrap gap-3">
            <a routerLink="/management/learning/properties" 
               class="bg-white text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors">
              Property Basics
            </a>
            <a routerLink="/management/learning/bookings" 
               class="bg-red-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-800 transition-colors">
              Booking Management
            </a>
            <a routerLink="/management/learning/guests" 
               class="bg-red-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-800 transition-colors">
              Guest Relations
            </a>
          </div>
        </div>
      </div>

      <!-- FAQ Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Frequently Asked Questions</h2>
        <div class="space-y-4">
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h3 class="font-medium text-gray-900 dark:text-white mb-2">How long does each module take?</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Most modules can be completed in 2-15 minutes. You can learn at your own pace and revisit content anytime.
            </p>
          </div>
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h3 class="font-medium text-gray-900 dark:text-white mb-2">Do I need special permissions to access learning content?</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              All learning content is available to users with management access. Some advanced modules may require higher permission levels.
            </p>
          </div>
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white mb-2">Can I suggest new learning topics?</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Absolutely! We're always looking to improve our learning content. Contact your system administrator with suggestions.
            </p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LearningCenterComponent implements OnInit {
  currentUser: AuthUser | null = null;

  learningModules: LearningModule[] = [
    {
      id: 'properties',
      title: 'Property Management',
      description: 'Learn how to set up and manage property groups, units, and amenities effectively.',
      icon: 'fas fa-building',
      route: 'properties',
      difficulty: 'beginner',
      duration: '10-15 minutes',
      topics: [
        'Creating property groups',
        'Managing unit types and quantities',
        'Setting up amenities',
        'Pricing strategies',
        'Property status management'
      ],
      requiredRoles: ['super_admin', 'owner', 'admin', 'support']
    },
    {
      id: 'bookings',
      title: 'Booking Management',
      description: 'Master the booking lifecycle from reservation to checkout.',
      icon: 'fas fa-calendar-check',
      route: 'bookings',
      difficulty: 'beginner',
      duration: '8-12 minutes',
      topics: [
        'Understanding booking statuses',
        'Managing reservations',
        'Handling cancellations',
        'Check-in/check-out processes',
        'Guest communication'
      ],
      requiredRoles: ['super_admin', 'owner', 'admin', 'support']
    },
    {
      id: 'payments',
      title: 'Payment Processing',
      description: 'Handle payments, refunds, and financial transactions securely.',
      icon: 'fas fa-credit-card',
      route: 'payments',
      difficulty: 'intermediate',
      duration: '12-18 minutes',
      topics: [
        'Payment methods setup',
        'Processing refunds',
        'Handling disputes',
        'Financial reporting',
        'Tax considerations'
      ],
      requiredRoles: ['super_admin', 'owner', 'admin']
    },
    {
      id: 'guests',
      title: 'Guest Relations',
      description: 'Provide exceptional guest experiences and handle inquiries professionally.',
      icon: 'fas fa-user-friends',
      route: 'guests',
      difficulty: 'beginner',
      duration: '6-10 minutes',
      topics: [
        'Guest communication best practices',
        'Handling special requests',
        'Managing guest profiles',
        'Feedback and reviews',
        'Problem resolution'
      ],
      requiredRoles: ['super_admin', 'owner', 'admin', 'support']
    },
    {
      id: 'reports',
      title: 'Reports & Analytics',
      description: 'Generate insights from your data to make informed business decisions.',
      icon: 'fas fa-chart-bar',
      route: 'reports',
      difficulty: 'advanced',
      duration: '15-20 minutes',
      topics: [
        'Financial reporting',
        'Occupancy analytics',
        'Revenue optimization',
        'Tax report generation',
        'Performance metrics'
      ],
      requiredRoles: ['super_admin', 'owner', 'admin']
    }
  ];

  get availableModules(): LearningModule[] {
    if (!this.currentUser) return [];
    
    return this.learningModules.filter(module => 
      module.requiredRoles.includes(this.currentUser!.role)
    );
  }

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.authState$.subscribe(authState => {
      this.currentUser = authState.user;
    });
  }

  getModuleIconClass(difficulty: string): string {
    const classes = {
      beginner: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
      intermediate: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
      advanced: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
    };
    return classes[difficulty as keyof typeof classes] || classes.beginner;
  }

  getDifficultyBadgeClass(difficulty: string): string {
    const classes = {
      beginner: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    return classes[difficulty as keyof typeof classes] || classes.beginner;
  }
}
