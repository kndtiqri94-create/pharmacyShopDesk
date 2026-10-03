import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { getModuleDefinition, moduleKeyFromUrl } from '../utils/module-definitions.util';

@Injectable({ providedIn: 'root' })
export class ShellStateService {
  private readonly router = inject(Router);
  private readonly menuOpenSignal = signal(false);
  private readonly currentUrlSignal = signal(this.router.url);

  readonly menuOpen = this.menuOpenSignal.asReadonly();
  readonly currentUrl = this.currentUrlSignal.asReadonly();
  readonly pageTitle = computed(() => this.titleForUrl(this.currentUrlSignal()));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(event => {
        this.currentUrlSignal.set(event.urlAfterRedirects);
        this.menuOpenSignal.set(false);
      });
  }

  openMenu(): void {
    this.menuOpenSignal.set(true);
  }

  closeMenu(): void {
    this.menuOpenSignal.set(false);
  }

  toggleMenu(): void {
    this.menuOpenSignal.update(open => !open);
  }

  private titleForUrl(url: string): string {
    const key = moduleKeyFromUrl(url);
    if (key !== null) return getModuleDefinition(key).label;
    const path = url.split('?')[0];
    if (path === '/' || path === '') return '';
    return path.startsWith('/access-denied') ? 'Access denied' : 'Page not found';
  }
}
