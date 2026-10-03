import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

function signInRedirect(returnUrl: string): UrlTree {
  return inject(Router).createUrlTree(['/sign-in'], { queryParams: { returnUrl } });
}

export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isSignedIn() ? true : signInRedirect(state.url);

export const authMatchGuard: CanMatchFn = (_route, segments) =>
  inject(AuthService).isSignedIn()
    ? true
    : signInRedirect(`/${segments.map(segment => segment.path).join('/')}`);
