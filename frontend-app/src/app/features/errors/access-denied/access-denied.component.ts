import { Component, computed, inject } from '@angular/core';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { PermissionService } from '../../../core/services/permission.service';
import { FallbackPageComponent } from '../fallback-page/fallback-page.component';

@Component({
  selector: 'app-access-denied',
  imports: [FallbackPageComponent],
  templateUrl: './access-denied.component.html',
  styleUrl: './access-denied.component.scss',
})
export class AccessDeniedComponent {
  private readonly permissionService = inject(PermissionService);

  protected readonly isPosDenied = computed(
    () => this.permissionService.deniedModule() === ModuleKey.POS
  );
}
