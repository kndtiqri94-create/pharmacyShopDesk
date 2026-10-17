import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import {
  moduleAccessActivateGuard,
  moduleAccessGuard,
} from '../../core/guards/module-access.guard';
import { ModuleKey } from '../../core/models/enums/module-key.enum';
import { UserRole } from '../../core/models/enums/user-role.enum';
import { PermissionService } from '../../core/services/permission.service';
import { routes } from '../../app.routes';
import { RELOAD_UTILITY_ROUTES } from './reload-utility/reload-utility.routes';
import { SETTINGS_ROUTES } from './settings/settings.routes';

describe('Reload & Utility and Settings routes', () => {
  const shell = routes.find(route => route.path === '' && route.children !== undefined)!;
  const moduleRoute = (path: string): Route => shell.children!.find(route => route.path === path)!;

  it('guard both modules on the way in and carry the module key', () => {
    for (const [path, key] of [
      ['reload-utility', ModuleKey.RELOAD_UTILITY],
      ['settings', ModuleKey.SETTINGS],
    ] as const) {
      const route = moduleRoute(path);
      expect(route.data?.['module']).withContext(path).toBe(key);
      expect(route.canMatch).withContext(path).toEqual([moduleAccessGuard]);
      expect(route.canActivate).withContext(path).toEqual([moduleAccessActivateGuard]);
    }
  });

  it('carry the module key on the screen routes too and no longer use the placeholder', () => {
    expect(RELOAD_UTILITY_ROUTES[0].data?.['module']).toBe(ModuleKey.RELOAD_UTILITY);
    expect(SETTINGS_ROUTES[0].data?.['module']).toBe(ModuleKey.SETTINGS);
    expect(RELOAD_UTILITY_ROUTES[0].component).toBeUndefined();
    expect(SETTINGS_ROUTES[0].component).toBeUndefined();
    expect(RELOAD_UTILITY_ROUTES[0].loadComponent).toBeDefined();
    expect(SETTINGS_ROUTES[0].loadComponent).toBeDefined();
  });

  describe('by typed address', () => {
    const configure = () =>
      TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter(routes)] });

    beforeEach(() => {
      clearBrowserStorage();
      configure();
    });

    afterEach(clearBrowserStorage);

    async function open(role: UserRole, url: string): Promise<string> {
      await signInAs(role);
      await TestBed.inject(PermissionService).load();
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      return TestBed.inject(Router).url;
    }

    it('stops Cashier, Pharmacist and Manager on Settings', async () => {
      for (const role of [UserRole.CASHIER, UserRole.PHARMACIST, UserRole.MANAGER]) {
        TestBed.resetTestingModule();
        configure();
        expect(await open(role, '/settings'))
          .withContext(role)
          .toBe('/access-denied');
      }
    });

    it('lets Admin into Settings and every role with access into Reload & Utility', async () => {
      expect(await open(UserRole.ADMIN, '/settings')).toBe('/settings');
      for (const role of [
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.CASHIER,
        UserRole.PHARMACIST,
      ]) {
        TestBed.resetTestingModule();
        configure();
        expect(await open(role, '/reload-utility'))
          .withContext(role)
          .toBe('/reload-utility');
      }
    });
  });
});
