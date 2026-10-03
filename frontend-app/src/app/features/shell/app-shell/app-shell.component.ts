import {
  Component,
  Injector,
  afterNextRender,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ACCESS_DENIED_PATH, PermissionService } from '../../../core/services/permission.service';
import { ShellStateService } from '../../../core/services/shell-state.service';
import { ViewportService } from '../../../core/services/viewport.service';
import { moduleKeyFromUrl } from '../../../core/utils/module-definitions.util';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopBarComponent } from '../top-bar/top-bar.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopBarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  host: {
    '(document:keydown.escape)': 'closeMenu()',
  },
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly sidebar = viewChild.required(SidebarComponent);
  private readonly topBar = viewChild.required(TopBarComponent);
  private menuWasOpen = false;

  protected readonly shellStateService = inject(ShellStateService);
  protected readonly viewportService = inject(ViewportService);

  constructor() {
    effect(() => this.redirectWhenAccessLost());
    effect(() => this.moveFocusWithMenu());
  }

  protected closeMenu(): void {
    if (this.shellStateService.menuOpen()) this.shellStateService.closeMenu();
  }

  protected focusMain(): void {
    document.getElementById('main-content')?.focus();
  }

  private redirectWhenAccessLost(): void {
    const url = this.shellStateService.currentUrl();
    const key = moduleKeyFromUrl(url);
    if (key === null || !this.authService.isSignedIn() || this.permissionService.canView(key))
      return;
    untracked(() => {
      this.router.navigateByUrl(ACCESS_DENIED_PATH, { replaceUrl: true }).catch(() => undefined);
    });
  }

  private moveFocusWithMenu(): void {
    const open = this.shellStateService.menuOpen();
    const drawerMode = this.viewportService.isDrawerMode();
    if (open === this.menuWasOpen) return;
    this.menuWasOpen = open;
    if (!drawerMode) return;
    afterNextRender(
      () => (open ? this.sidebar().focusFirstLink() : this.topBar().focusMenuButton()),
      { injector: this.injector }
    );
  }
}
