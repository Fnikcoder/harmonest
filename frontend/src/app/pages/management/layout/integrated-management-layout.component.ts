import { Component, OnInit, OnDestroy, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, AuthUser } from '../../../services/auth.service';
import { hasPermission, hasRole } from '../../../config/auth.config';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import * as feather from 'feather-icons';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  requiredRoles: string[];
  requiredPermissions?: string[];
  children?: MenuItem[];
}

@Component({
  selector: 'app-integrated-management-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NavbarComponent],
  template: `
    <!-- Main Website Navbar -->
    <app-navbar></app-navbar>

    <!-- Management Page Content -->
    <div class="relative md:mt-[84px] mt-[70px] bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div class="container mx-auto px-4 py-6">

        <!-- Page Header -->
        <div class="mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <button (click)="toggleSidebar()"
                      class="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <i data-feather="menu" class="size-5"></i>
              </button>

              <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Management</h1>
                <p class="text-gray-600 dark:text-gray-400">Manage your properties and bookings</p>
              </div>
            </div>

            <div class="flex items-center space-x-3">
              <!-- Notifications -->
<!--              <button class="relative text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-2">-->
<!--                <i class="fas fa-bell text-lg"></i>-->
<!--                <span *ngIf="hasNotifications" class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>-->
<!--              </button>-->

              <!-- Quick Actions -->
              <div class="hidden sm:flex items-center space-x-2">
                <button class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <i data-feather="plus" class="size-4 mr-2"></i>Quick Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Management Layout -->
        <div class="flex gap-6">

          <!-- Mobile Overlay -->
          <div *ngIf="sidebarOpen && isMobile"
               (click)="closeSidebar()"
               class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"></div>

          <!-- Sidebar -->
          <aside class="w-64 flex-shrink-0 transform transition-transform duration-300 ease-in-out"
                 [class.translate-x-0]="sidebarOpen || !isMobile"
                 [class.-translate-x-full]="!sidebarOpen && isMobile"
                 [class.fixed]="isMobile"
                 [class.relative]="!isMobile"
                 [class.z-50]="isMobile"
                 [class.h-screen]="isMobile"
                 [class.top-0]="isMobile"
                 [class.left-0]="isMobile">

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full">

              <!-- Sidebar Header -->
              <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Management</h2>
                <button (click)="closeSidebar()"
                        class="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1">
                  <i data-feather="x" class="size-5"></i>
                </button>
              </div>

              <!-- Navigation -->
              <nav class="flex-1 overflow-y-auto p-4">
                <div class="space-y-1">
                  <ng-container *ngFor="let item of visibleMenuItems">
                    <div *ngIf="!item.children">
                      <a [routerLink]="item.route"
                         routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                         (click)="onMobileMenuClick()"
                         class="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-transparent">
                        <i [attr.data-feather]="item.icon" class="size-4 mr-3"></i>
                        {{ item.label }}
                      </a>
                    </div>

                    <!-- Submenu items -->
                    <div *ngIf="item.children" class="space-y-1">
                      <button (click)="toggleSubmenu(item.id)"
                              class="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div class="flex items-center">
                          <i [attr.data-feather]="item.icon" class="size-4 mr-3"></i>
                          {{ item.label }}
                        </div>
                        <i data-feather="chevron-down" class="size-3 transition-transform duration-200"
                           [class.rotate-180]="openSubmenus.has(item.id)"></i>
                      </button>

                      <div *ngIf="openSubmenus.has(item.id)" class="ml-6 space-y-1">
                        <a *ngFor="let child of item.children"
                           [routerLink]="child.route"
                           routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                           (click)="onMobileMenuClick()"
                           class="flex items-center px-3 py-2 text-xs text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <i [attr.data-feather]="child.icon" class="size-3 mr-2"></i>
                          {{ child.label }}
                        </a>
                      </div>
                    </div>
                  </ng-container>
                </div>
              </nav>

              <!-- Back to Main Site -->
              <div class="p-4 border-t border-gray-200 dark:border-gray-700">
                <a routerLink="/"
                   class="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <i data-feather="arrow-left" class="size-4 mr-3"></i>
                  Back to Main Site
                </a>
              </div>
            </div>
          </aside>

          <!-- Main Content Area -->
          <main class="flex-1 min-w-0">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 min-h-[600px]">
              <router-outlet></router-outlet>
            </div>
          </main>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Custom scrollbar for sidebar */
    nav::-webkit-scrollbar {
      width: 4px;
    }
    nav::-webkit-scrollbar-track {
      background: transparent;
    }
    nav::-webkit-scrollbar-thumb {
      background: rgba(156, 163, 175, 0.3);
      border-radius: 2px;
    }
    nav::-webkit-scrollbar-thumb:hover {
      background: rgba(156, 163, 175, 0.5);
    }

    /* Smooth transitions */
    .transition-all {
      transition-property: all;
    }
  `]
})
export class IntegratedManagementLayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  currentUser: AuthUser | null = null;
  sidebarOpen = false;
  isMobile = false;
  pageTitle = 'Management';
  hasNotifications = true;
  openSubmenus = new Set<string>();

  // Menu items configuration using Feather Icons - Dashboard + 3 main sections
  menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'activity',
      route: '/management/dashboard',
      requiredRoles: ['super_admin', 'owner', 'admin', 'support', 'user'] // Added 'user' for testing
    },
    {
      id: 'reservations',
      label: 'Reservations',
      icon: 'calendar',
      route: '/management/reservations',
      requiredRoles: ['super_admin', 'owner', 'admin', 'support', 'user'] // Added 'user' for testing
    },
    {
      id: 'listings',
      label: 'Listings',
      icon: 'list',
      route: '/management/listings',
      requiredRoles: ['super_admin', 'owner', 'admin', 'user'] // Added 'user' for testing
    },
    {
      id: 'doors',
      label: 'Smart Doors',
      icon: 'key',
      route: '/management/doors',
      requiredRoles: ['super_admin', 'owner', 'admin', 'user'] // Added 'user' for testing
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.checkScreenSize();
  }

  ngOnInit() {
    // Subscribe to auth state
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(authState => {
        this.currentUser = authState.user;
      });

    // Set initial sidebar state based on screen size
    // On desktop, sidebar is open by default
    // On mobile, sidebar is closed by default
    this.sidebarOpen = !this.isMobile;

    // Update page title based on route
    this.updatePageTitle();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit() {
    // Initialize Feather Icons
    feather.replace();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 1024;

    // If switching from mobile to desktop, open sidebar
    if (wasMobile && !this.isMobile) {
      this.sidebarOpen = true;
    }
    // If switching from desktop to mobile, close sidebar
    else if (!wasMobile && this.isMobile) {
      this.sidebarOpen = false;
    }
  }

  get visibleMenuItems(): MenuItem[] {
    return this.menuItems.filter(item => this.canShowMenuItem(item));
  }

  private canShowMenuItem(item: MenuItem): boolean {
    if (!this.currentUser) return false;
    return item.requiredRoles.includes(this.currentUser.role);
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  onMobileMenuClick() {
    if (this.isMobile) {
      this.closeSidebar();
    }
  }

  toggleSubmenu(itemId: string) {
    if (this.openSubmenus.has(itemId)) {
      this.openSubmenus.delete(itemId);
    } else {
      this.openSubmenus.add(itemId);
    }
  }

  private updatePageTitle() {
    // Update page title based on current route
    const currentRoute = this.router.url;
    const menuItem = this.findMenuItemByRoute(currentRoute);
    this.pageTitle = menuItem?.label || 'Management';
  }

  private findMenuItemByRoute(route: string): MenuItem | null {
    for (const item of this.menuItems) {
      if (item.route === route) return item;
      if (item.children) {
        const child = item.children.find(child => child.route === route);
        if (child) return child;
      }
    }
    return null;
  }
}
