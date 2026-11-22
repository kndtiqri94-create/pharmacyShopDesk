import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ShellStateService } from './shell-state.service';

@Component({ template: '', selector: 'app-blank' })
class BlankComponent {}

describe('ShellStateService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'products', component: BlankComponent },
          { path: 'grn', component: BlankComponent },
          { path: 'access-denied', component: BlankComponent },
          { path: '**', component: BlankComponent },
        ]),
      ],
    });
  });

  it('opens, closes and toggles the menu', () => {
    const service = TestBed.inject(ShellStateService);
    service.openMenu();
    expect(service.menuOpen()).toBeTrue();
    service.toggleMenu();
    expect(service.menuOpen()).toBeFalse();
    service.toggleMenu();
    service.closeMenu();
    expect(service.menuOpen()).toBeFalse();
  });

  it('closes the menu when the page changes', async () => {
    const service = TestBed.inject(ShellStateService);
    service.openMenu();
    await TestBed.inject(Router).navigateByUrl('/grn');
    expect(service.menuOpen()).toBeFalse();
  });

  it('derives a short page title from the address', async () => {
    const service = TestBed.inject(ShellStateService);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');
    expect(service.pageTitle()).toBe('Products');
    await router.navigateByUrl('/access-denied');
    expect(service.pageTitle()).toBe('Access denied');
    await router.navigateByUrl('/');
    expect(service.pageTitle()).toBe('');
    await router.navigateByUrl('/nowhere');
    expect(service.pageTitle()).toBe('Page not found');
  });
});

describe('ShellStateService sidebar hiding for the till', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: BlankComponent }])],
    });
  });

  it('shows the sidebar until the till asks for it to be hidden', () => {
    expect(TestBed.inject(ShellStateService).sidebarHidden()).toBeFalse();
  });

  it('hides and shows the sidebar on request', () => {
    const service = TestBed.inject(ShellStateService);
    service.setSidebarHidden(true);
    expect(service.sidebarHidden()).toBeTrue();
    service.setSidebarHidden(false);
    expect(service.sidebarHidden()).toBeFalse();
  });

  it('closes an open menu when the sidebar becomes hidden, but still lets the menu open afterwards', () => {
    const service = TestBed.inject(ShellStateService);
    service.openMenu();
    service.setSidebarHidden(true);
    expect(service.menuOpen()).toBeFalse();
    service.openMenu();
    expect(service.menuOpen()).toBeTrue();
  });

  it('titles the till page POS', async () => {
    const service = TestBed.inject(ShellStateService);
    await TestBed.inject(Router).navigateByUrl('/pos');
    expect(service.pageTitle()).toBe('POS');
  });
});
