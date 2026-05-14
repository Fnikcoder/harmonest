import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgClickOutsideDirective } from 'ng-click-outside2';
import { Subject, takeUntil, Observable } from 'rxjs';
import * as feather from 'feather-icons';
import { TranslateService } from '@ngx-translate/core';
import { AuthService, AuthUser } from '../../services/auth.service';

import { RoleService } from '../../services/role.service';
import { HasRoleDirective } from '../../directives/has-role.directive';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NgClickOutsideDirective,
    HasRoleDirective
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Input() navLight: any;
  @Input() navClass:any

  private destroy$ = new Subject<void>();

  manu:string = '';
  subManu:string = '';
  toggleManu:boolean = false
  searchManu:boolean = false
  userManu:boolean = false

  // sticky-navbar
  isSticky: boolean = false;

  // Authentication
  currentUser: AuthUser | null = null;
  isAuthenticated = false;
  authLoading = true;

  // Role checking
  hasManagementAccess$!: Observable<boolean>;

  @HostListener('window:scroll', ['$event'])
  checkScroll() {
    this.isSticky = window.pageYOffset > 0;

  }
  constructor(
    private router: Router,
    private translate: TranslateService,
    private authService: AuthService,
    private roleService: RoleService
  ) {
    translate.addLangs(['en', 'de']);
    translate.setDefaultLang('en');

    const browserLang = this.translate.getBrowserLang();
    const langToUse = browserLang && ['en', 'de'].includes(browserLang) ? browserLang : 'en';
    this.translate.use(langToUse);
  }

  ngOnInit() {
    const current = this.router.url;
    this.manu = current
    this.subManu = current
    window.scrollTo(0, 0);

    // Initialize role checking
    this.hasManagementAccess$ = this.roleService.hasManagementAccess();

    // Subscribe to authentication state
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(authState => {
        this.isAuthenticated = authState.isAuthenticated;
        this.currentUser = authState.user;
        this.authLoading = authState.loading;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit() {
    feather.replace();
  }

  changeLang(lang: string) {
    this.translate.use(lang);
  }

  get currentLang(): string {
    return this.translate.currentLang;
  }
  openManu(item:string){
    this.subManu = item
  }
  toggleMenu(){
    this.toggleManu = !this.toggleManu
  }

  // search- modal
  searchModal(){
    this.searchManu=!this.searchManu
  }
  closeSearchModal() {
    this.searchManu = false;
  }

  // cart-modal
  cart:boolean = false;
  cartModal(){
    this.cart=!this.cart
  }
  closeCartModal() {
    this.cart = false;
  }

    // user-modal
    user:boolean = false;
    userModal(){
      this.user=!this.user
    }
    closeUserModal() {
      this.user = false;
    }

    // Authentication methods
    logout() {
      this.authService.signOut().subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: (error) => {
          // Handle logout error silently or show user-friendly message
        }
      });
    }

    get hasManagementAccess(): boolean {
      // Show management access if user is authenticated and has the right role
      // Don't wait for loading to complete if we already have user info
      return this.currentUser ?
        ['super_admin', 'owner', 'admin', 'support'].includes(this.currentUser.role) :
        false;
    }
}
