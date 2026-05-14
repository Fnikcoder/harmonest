import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { RoleService } from '../services/role.service';
import { UserRole } from '../utils/role.utils';

@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private hasView = false;

  @Input() set appHasRole(roles: UserRole | UserRole[]) {
    this.checkRole(roles);
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private roleService: RoleService
  ) {}

  ngOnInit() {
    // Initial check will be done when appHasRole is set
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkRole(roles: UserRole | UserRole[]) {
    const roleArray = Array.isArray(roles) ? roles : [roles];

    this.roleService.hasAnyRole(roleArray)
      .pipe(takeUntil(this.destroy$))
      .subscribe(hasRole => {
        if (hasRole && !this.hasView) {
          this.viewContainer.createEmbeddedView(this.templateRef);
          this.hasView = true;
        } else if (!hasRole && this.hasView) {
          this.viewContainer.clear();
          this.hasView = false;
        }
      });
  }
}
