import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { ACCESS_DENIED_PATH, PermissionService } from '../services/permission.service';
import { isModuleKey } from '../utils/module-definitions.util';

const PARAM_PREFIX = ':';

function viewOnlyTree(route: ActivatedRouteSnapshot, router: Router): UrlTree | null {
  const pattern: unknown = route.data['viewOnlyRedirect'];
  if (typeof pattern !== 'string') return null;
  const segments = pattern
    .split('/')
    .filter(segment => segment.length > 0)
    .map(segment =>
      segment.startsWith(PARAM_PREFIX)
        ? String(route.params[segment.slice(PARAM_PREFIX.length)] ?? '')
        : segment
    );
  return segments.some(segment => segment.length === 0) ? null : router.createUrlTree(segments);
}

export const moduleWriteGuard: CanActivateFn = route => {
  const moduleKey: unknown = route.data['module'];
  const router = inject(Router);
  if (!isModuleKey(moduleKey)) return router.parseUrl(ACCESS_DENIED_PATH);
  const permissionService = inject(PermissionService);
  if (permissionService.canWrite(moduleKey)) return true;
  const viewOnly = permissionService.canView(moduleKey) ? viewOnlyTree(route, router) : null;
  return viewOnly ?? router.parseUrl(ACCESS_DENIED_PATH);
};
