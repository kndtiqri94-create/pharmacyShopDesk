import { TestBed } from '@angular/core/testing';
import { Router, Route, UrlSegment, UrlTree } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { moduleAccessGuard } from '../guards/module-access.guard';
import { ALL_USER_ROLES } from '../models/enums/user-role.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { MODULE_DEFINITIONS } from '../utils/module-definitions.util';
import { PermissionService } from './permission.service';
import { RoleDataService } from './data/role-data.service';
import { firstValueFrom } from 'rxjs';

describe('permission matrix consistency (sidebar, page access and actions)', () => {
  afterEach(clearBrowserStorage);

  for (const role of ALL_USER_ROLES) {
    it(`agrees for every module when signed in as ${role}`, async () => {
      clearBrowserStorage();
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      await signInAs(role);
      const permissionService = TestBed.inject(PermissionService);
      const router = TestBed.inject(Router);
      const matrix = await firstValueFrom(TestBed.inject(RoleDataService).getMatrix());
      const sidebarPaths = permissionService.allowedModules().map(definition => definition.path);

      for (const definition of MODULE_DEFINITIONS) {
        const level = matrix[role][definition.key];
        const guardResult = TestBed.runInInjectionContext(() =>
          moduleAccessGuard(
            { data: { module: definition.key } } as Route,
            [new UrlSegment(definition.path, {})],
            {} as never
          )
        );
        const reachable = guardResult === true;
        const message = `${role} ${definition.key}`;

        expect(sidebarPaths.includes(definition.path)).withContext(message).toBe(reachable);
        expect(permissionService.canView(definition.key)).withContext(message).toBe(reachable);
        expect(reachable)
          .withContext(message)
          .toBe(level !== PermissionLevel.NONE);
        expect(permissionService.canWrite(definition.key))
          .withContext(message)
          .toBe(level === PermissionLevel.FULL);
        if (!reachable) {
          expect(router.serializeUrl(guardResult as UrlTree))
            .withContext(message)
            .toBe('/access-denied');
        }
      }
    });
  }
});
