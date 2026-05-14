import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, AuthUser } from '../../services/auth.service';

@Component({
  selector: 'app-tab-account',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './tab-account.component.html',
  styleUrl: './tab-account.component.scss'
})
export class TabAccountComponent implements OnInit, OnDestroy {
  current: string = '';
  user: AuthUser | null = null;
  isManagementUser = false;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.current = this.router.url;

    // Subscribe to auth state to get current user
    this.authService.authState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(authState => {
      this.user = authState.user;
      this.isManagementUser = authState.user ?
        ['super_admin', 'owner', 'admin', 'support'].includes(authState.user.role) :
        false;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  logout(): void {
    this.authService.signOut().subscribe();
  }
}
