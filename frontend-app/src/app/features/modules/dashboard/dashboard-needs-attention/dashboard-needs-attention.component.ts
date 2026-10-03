import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionService } from '../../../../core/services/permission.service';
import { NeedsAttentionRow } from '../../../../core/utils/dashboard-metrics.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-dashboard-needs-attention',
  imports: [ButtonComponent, CardComponent, EmptyStateComponent],
  templateUrl: './dashboard-needs-attention.component.html',
  styleUrl: './dashboard-needs-attention.component.scss',
})
export class DashboardNeedsAttentionComponent {
  readonly rows = input.required<readonly NeedsAttentionRow[]>();

  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  protected isAllowed(row: NeedsAttentionRow): boolean {
    return row.changesData
      ? this.permissionService.canWrite(row.targetModule)
      : this.permissionService.canView(row.targetModule);
  }

  protected open(row: NeedsAttentionRow): void {
    if (!this.isAllowed(row)) return;
    this.router
      .navigate([...row.commands], { queryParams: row.queryParams ?? undefined })
      .catch(() => undefined);
  }
}
