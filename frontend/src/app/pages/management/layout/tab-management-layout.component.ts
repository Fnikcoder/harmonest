import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';
import { AuthService, AuthUser } from '../../../services/auth.service';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import * as feather from 'feather-icons';

interface TabItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  requiredRoles: string[];
}

@Component({
  selector: 'app-tab-management-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NavbarComponent],
  template: `
    <!-- Main Website Navbar -->
    <app-navbar></app-navbar>

    <!-- Management Page Content -->
    <div class="relative md:mt-[84px] mt-[70px] bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div class="container mx-auto px-4 py-6">
        
        <!-- Management Header -->
        <div class="mb-6">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Management</h1>
              <p class="text-gray-600 dark:text-gray-400 mt-1">Manage your reservations, listings, and smart doors</p>
            </div>
            
            <!-- Back to Main Site -->
            <a routerLink="/"
               class="inline-flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <i data-feather="arrow-left" class="size-4 mr-2"></i>
              Back to Main Site
            </a>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div class="border-b border-gray-200 dark:border-gray-700">
            <nav class="flex space-x-8 px-6" aria-label="Management Tabs">
              <button
                *ngFor="let tab of visibleTabs"
                [routerLink]="tab.route"
                routerLinkActive="active-tab"
                [routerLinkActiveOptions]="{exact: false}"
                class="tab-button flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200"
                [class.active-tab]="isActiveTab(tab.route)"
              >
                <i [attr.data-feather]="tab.icon" class="size-4 mr-2"></i>
                {{ tab.label }}
              </button>
            </nav>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Tab Styling */
    .tab-button {
      border-bottom-color: transparent;
      color: rgb(107 114 128); /* text-gray-500 */
      white-space: nowrap;
    }

    .tab-button:hover {
      color: rgb(59 130 246); /* text-blue-600 */
      border-bottom-color: rgb(209 213 219); /* border-gray-300 */
    }

    .tab-button.active-tab {
      color: rgb(59 130 246); /* text-blue-600 */
      border-bottom-color: rgb(59 130 246); /* border-blue-600 */
    }

    /* Dark mode */
    .dark .tab-button {
      color: rgb(156 163 175); /* text-gray-400 */
    }

    .dark .tab-button:hover {
      color: rgb(96 165 250); /* text-blue-400 */
      border-bottom-color: rgb(75 85 99); /* border-gray-600 */
    }

    .dark .tab-button.active-tab {
      color: rgb(96 165 250); /* text-blue-400 */
      border-bottom-color: rgb(96 165 250); /* border-blue-400 */
    }

    /* Smooth transitions */
    .transition-colors {
      transition-property: color, border-color;
    }
  `]
})
export class TabManagementLayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  currentUser: AuthUser | null = null;
  currentRoute = '';

  // Tab items configuration - Only 3 main sections
  tabItems: TabItem[] = [
    {
      id: 'reservations',
      label: 'Reservations',
      icon: 'calendar',
      route: '/management/reservations',
      requiredRoles: ['super_admin', 'owner', 'admin', 'support', 'user']
    },
    {
      id: 'listings',
      label: 'Listings',
      icon: 'list',
      route: '/management/listings',
      requiredRoles: ['super_admin', 'owner', 'admin', 'user']
    },
    {
      id: 'doors',
      label: 'Smart Doors',
      icon: 'key',
      route: '/management/doors',
      requiredRoles: ['super_admin', 'owner', 'admin', 'user']
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to auth state
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(authState => {
        this.currentUser = authState.user;
      });

    // Subscribe to router events to track current route
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.url;
      });

    // Set initial route
    this.currentRoute = this.router.url;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit() {
    // Initialize Feather Icons
    setTimeout(() => {
      feather.replace();
    }, 100);
  }

  get visibleTabs(): TabItem[] {
    return this.tabItems.filter(tab => this.canShowTab(tab));
  }

  private canShowTab(tab: TabItem): boolean {
    if (!this.currentUser) return false;
    return tab.requiredRoles.includes(this.currentUser.role);
  }

  isActiveTab(route: string): boolean {
    return this.currentRoute.startsWith(route);
  }
}
