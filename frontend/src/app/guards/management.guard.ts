import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { RoleService } from '../services/role.service';

@Injectable({
  providedIn: 'root'
})
export class ManagementGuard implements CanActivate {

  constructor(
    private roleService: RoleService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.roleService.hasManagementAccess().pipe(
      tap(hasAccess => {
        if (!hasAccess) {
          console.log('❌ Management access denied - redirecting to home');
          this.router.navigate(['/']);
        } else {
          console.log('✅ Management access granted');
        }
      }),
      map(hasAccess => hasAccess)
    );
  }
}
