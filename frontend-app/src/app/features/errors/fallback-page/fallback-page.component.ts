import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ACCESS_DENIED_PATH, PermissionService } from '../../../core/services/permission.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-fallback-page',
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, PageHeaderComponent],
  templateUrl: './fallback-page.component.html',
  styleUrl: './fallback-page.component.scss',
})
export class FallbackPageComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly emptyTitle = input.required<string>();
  readonly message = input.required<string>();

  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  protected readonly hasDestination = computed(
    () => this.permissionService.firstAllowedPath() !== ACCESS_DENIED_PATH
  );

  protected goToFirstModule(): void {
    this.router.navigateByUrl(this.permissionService.firstAllowedPath()).catch(() => undefined);
  }
}
