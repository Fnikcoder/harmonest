import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { TaglineComponent } from '../../../components/tagline/tagline.component';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
// DISABLED: Removed unused imports for disabled components
// import { FormComponent } from '../../../components/form/form.component';
// import { GridDataComponent } from '../../../components/grid-data/grid-data.component';
// import { AboutComponent } from '../../../components/about/about.component';
// import { ClientComponent } from '../../../components/client/client.component';
// import { BlogComponent } from '../../../components/blog/blog.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

// Role checking imports
import { RoleService } from '../../../services/role.service';
import { AuthService, AuthUser } from '../../../services/auth.service';
import { HasRoleDirective } from '../../../directives/has-role.directive';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';
import { RoleCheckerComponent } from '../../../components/role-checker/role-checker.component';

import * as feather from 'feather-icons';
import Package from '../../../data/packages.json'
import {TranslatePipe} from '@ngx-translate/core';
import {CountUpModule} from 'ngx-countup';

@Component({
  selector: 'app-index-one',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TaglineComponent,
    NavbarComponent,
    // DISABLED: Removed unused component imports
    // FormComponent,
    // GridDataComponent,
    // AboutComponent,
    // ClientComponent,
    // BlogComponent,
    FooterComponent,
    SwitcherComponent,
    TranslatePipe,
    CountUpModule,
    TitleCasePipe,
    // Role checking directives
    HasRoleDirective,
    HasPermissionDirective,
    RoleCheckerComponent
  ],
  templateUrl: './index-one.component.html',
  styleUrl: './index-one.component.scss'
})
export class IndexOneComponent {

  // DISABLED: Package data no longer needed since property listings are disabled
  // package = Package

  // Role checking observables
  hasManagementAccess$: Observable<boolean>;
  currentUser$: Observable<AuthUser | null>;
  isAdminLevel$: Observable<boolean>;
  authLoading$: Observable<boolean>;

  constructor(
    private roleService: RoleService,
    private authService: AuthService
  ) {
    // Initialize role checking observables
    this.hasManagementAccess$ = this.roleService.hasManagementAccess();
    this.currentUser$ = this.roleService.getCurrentUser();
    this.isAdminLevel$ = this.roleService.isAdminLevel();
    this.authLoading$ = this.authService.authState$.pipe(
      map(authState => authState.loading)
    );
  }

  ngAfterViewInit() {
    feather.replace();
  }

  /**
   * Navigate to management panel
   */
  navigateToManagement() {
    // This method can be called from template
    // Navigation will be handled by router
  }
}
