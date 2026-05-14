import { Routes } from '@angular/router';
import { AuthGuard } from '../../../guards/auth.guard';

export const propertiesRoutes: Routes = [
  {
    path: '',
    redirectTo: 'groups',
    pathMatch: 'full'
  },
  {
    path: 'groups',
    loadComponent: () => import('./property-groups/property-groups.component').then(m => m.PropertyGroupsComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  },
  {
    path: 'groups/:id',
    loadComponent: () => import('./property-groups/property-group-detail.component').then(m => m.PropertyGroupDetailComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  },
  {
    path: 'units',
    loadComponent: () => import('./units/units-management.component').then(m => m.UnitsManagementComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  },
  {
    path: 'units/:id',
    loadComponent: () => import('./units/unit-detail.component').then(m => m.UnitDetailComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  },
  {
    path: 'amenities',
    loadComponent: () => import('./amenities/amenities-management.component').then(m => m.AmenitiesManagementComponent),
    canActivate: [AuthGuard],
    data: { requiredRoles: ['super_admin', 'owner', 'admin'] }
  }
];
