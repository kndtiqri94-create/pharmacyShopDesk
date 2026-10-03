import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { PermissionLevel } from '../../../core/models/enums/permission-level.enum';
import { CanWriteDirective } from '../../../core/directives/permission-write.directive';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { getModuleDefinition } from '../../../core/utils/module-definitions.util';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-module-placeholder',
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CanWriteDirective,
    CardComponent,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './module-placeholder.component.html',
  styleUrl: './module-placeholder.component.scss',
})
export class ModulePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  protected readonly moduleKey: ModuleKey = this.route.snapshot.data['module'];
  protected readonly definition = getModuleDefinition(this.moduleKey);
  protected readonly isViewOnly = computed(
    () => this.permissionService.levelFor(this.moduleKey) === PermissionLevel.VIEW
  );

  protected showSampleMessage(): void {
    this.notificationService.showSampleOnly('This action');
  }
}
