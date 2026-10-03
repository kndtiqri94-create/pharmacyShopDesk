import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { ACCESS_DENIED_PATH, PermissionService } from '../services/permission.service';
import { isModuleKey } from '../utils/module-definitions.util';

function resolveAccess(moduleKey: unknown, requestedUrl: string): boolean | UrlTree {
  const router = inject(Router);
  if (!inject(AuthService).isSignedIn()) {
    return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: requestedUrl } });
  }
  if (isModuleKey(moduleKey) && inject(PermissionService).canView(moduleKey)) return true;
  return router.parseUrl(ACCESS_DENIED_PATH);
}

export const moduleAccessGuard: CanMatchFn = (route, segments) =>
  resolveAccess(route.data?.['module'], `/${segments.map(segment => segment.path).join('/')}`);

export const moduleAccessActivateGuard: CanActivateFn = (route, state) =>
  resolveAccess(route.data['module'], state.url);
