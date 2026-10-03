import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const landingGuard: CanActivateFn = () =>
  inject(Router).parseUrl(inject(PermissionService).firstAllowedPath());
