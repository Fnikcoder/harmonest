import { Routes } from '@angular/router';
import { AuthGuard } from '../../guards/auth.guard';

export const managementRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/tab-management-layout.component').then(m => m.TabManagementLayoutComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] },
    children: [
      {
        path: '',
        redirectTo: 'reservations',
        pathMatch: 'full'
      },
      {
        path: 'reservations',
        loadComponent: () => import('./reservations/reservations-management.component').then(m => m.ReservationsManagementComponent),
        data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] }
      },
      {
        path: 'reservations/:id',
        loadComponent: () => import('./reservations/reservation-detail.component').then(m => m.ReservationDetailComponent),
        data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] }
      },
      {
        path: 'listings',
        loadComponent: () => import('./listings/listings-management.component').then(m => m.ListingsManagementComponent),
        data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
      },
      {
        path: 'listings/:id',
        loadComponent: () => import('./listings/listing-detail.component').then(c => c.ListingDetailComponent),
        data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
      },
      {
        path: 'doors',
        loadComponent: () => import('./doors/doors-management.component').then(m => m.DoorsManagementComponent),
        data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
      },
      // Legacy routes redirects
      {
        path: 'dashboard',
        redirectTo: 'reservations',
        pathMatch: 'full'
      },
      {
        path: 'properties',
        redirectTo: 'listings',
        pathMatch: 'prefix'
      }
    ]
  }
];
