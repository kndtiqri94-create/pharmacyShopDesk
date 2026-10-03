import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ACCESS_DENIED_PATH, PermissionService } from '../services/permission.service';
import { isModuleKey } from '../utils/module-definitions.util';

export const moduleWriteGuard: CanActivateFn = route => {
  const moduleKey: unknown = route.data['module'];
  if (isModuleKey(moduleKey) && inject(PermissionService).canWrite(moduleKey)) return true;
  return inject(Router).parseUrl(ACCESS_DENIED_PATH);
};
