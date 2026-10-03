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
