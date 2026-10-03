import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { PermissionService } from '../services/permission.service';

export const signInRedirectGuard: CanActivateFn = () => {
  if (!inject(AuthService).isSignedIn()) return true;
  return inject(Router).parseUrl(inject(PermissionService).firstAllowedPath());
};
