import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { RoleService } from '../services/role.service';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private hasView = false;

  @Input() set appHasPermission(permission: string) {
    this.checkPermission(permission);
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private roleService: RoleService
  ) {}

  ngOnInit() {
    // Initial check will be done when appHasPermission is set
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkPermission(permission: string) {
    this.roleService.hasPermission(permission)
      .pipe(takeUntil(this.destroy$))
      .subscribe(hasPermission => {
        if (hasPermission && !this.hasView) {
          this.viewContainer.createEmbeddedView(this.templateRef);
          this.hasView = true;
        } else if (!hasPermission && this.hasView) {
          this.viewContainer.clear();
          this.hasView = false;
        }
      });
  }
}
