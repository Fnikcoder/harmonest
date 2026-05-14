import { Routes } from '@angular/router';
import { AuthGuard } from '../../../guards/auth.guard';

export const reportsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./reports-overview.component').then(m => m.ReportsOverviewComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  },
  {
    path: 'financial',
    loadComponent: () => import('./financial-reports.component').then(m => m.FinancialReportsComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  },
  {
    path: 'tax',
    loadComponent: () => import('./tax-reports.component').then(m => m.TaxReportsComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  },
  {
    path: 'occupancy',
    loadComponent: () => import('./occupancy-reports.component').then(m => m.OccupancyReportsComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  }
];
