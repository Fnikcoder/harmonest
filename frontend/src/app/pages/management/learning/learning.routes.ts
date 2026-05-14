import { Routes } from '@angular/router';
import { AuthGuard } from '../../../guards/auth.guard';

export const learningRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./learning-center.component').then(m => m.LearningCenterComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] }
  },
  {
    path: 'properties',
    loadComponent: () => import('./modules/properties-learning.component').then(m => m.PropertiesLearningComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] }
  },
  {
    path: 'bookings',
    loadComponent: () => import('./modules/bookings-learning.component').then(m => m.BookingsLearningComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] }
  },
  {
    path: 'payments',
    loadComponent: () => import('./modules/payments-learning.component').then(m => m.PaymentsLearningComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] }
  },
  {
    path: 'guests',
    loadComponent: () => import('./modules/guests-learning.component').then(m => m.GuestsLearningComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] }
  },
  {
    path: 'reports',
    loadComponent: () => import('./modules/reports-learning.component').then(m => m.ReportsLearningComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin', 'support'] }
  }
];
