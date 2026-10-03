import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, ElementRef, computed, inject, input, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { forkJoin, map, switchMap } from 'rxjs';
import { ModuleDefinition } from '../../../core/models/domain/module-definition.model';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { ClockService } from '../../../core/services/clock.service';
import { GrnDataService } from '../../../core/services/data/grn-data.service';
import { ProductDataService } from '../../../core/services/data/product-data.service';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ShellStateService } from '../../../core/services/shell-state.service';
import { MODULE_GROUP_ORDER } from '../../../core/utils/module-definitions.util';
import { SidebarCounts, computeSidebarCounts } from '../../../core/utils/sidebar-counts.util';
import { IconComponent } from '../../../shared/components/icon/icon.component';

interface SidebarGroup {
  name: string;
  items: readonly ModuleDefinition[];
}

const EMPTY_COUNTS: SidebarCounts = {};

@Component({
  selector: 'app-sidebar',
  imports: [CdkTrapFocus, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly open = input(false);
  readonly drawerMode = input(false);

  private readonly permissionService = inject(PermissionService);
  private readonly shellStateService = inject(ShellStateService);
  private readonly productDataService = inject(ProductDataService);
  private readonly grnDataService = inject(GrnDataService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly clockService = inject(ClockService);
  private readonly navigation = viewChild<ElementRef<HTMLElement>>('navigation');

  protected readonly groups = computed<readonly SidebarGroup[]>(() =>
    MODULE_GROUP_ORDER.map(name => ({
      name,
      items: this.permissionService
        .allowedModules()
        .filter(definition => definition.group === name),
    })).filter(group => group.items.length > 0)
  );

  protected readonly counts = toSignal<SidebarCounts, SidebarCounts>(
    toObservable(this.shellStateService.currentUrl).pipe(
      switchMap(() =>
        forkJoin({
          products: this.productDataService.getAll(),
          grns: this.grnDataService.getAll(),
          settings: this.settingsDataService.get(),
        })
      ),
      map(({ products, grns, settings }) =>
        computeSidebarCounts(products, grns, settings, this.clockService.today())
      )
    ),
    { initialValue: EMPTY_COUNTS }
  );

  protected countFor(key: ModuleKey): number | null {
    const count = this.counts()[key];
    return count !== undefined && count > 0 ? count : null;
  }

  focusFirstLink(): void {
    this.navigation()?.nativeElement.querySelector<HTMLElement>('a')?.focus();
  }
}
