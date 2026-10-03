import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { environment } from '@environments/environment';
import { routes } from './app.routes';
import { AppTitleStrategy } from './core/services/app-title.strategy';
import { AuthService } from './core/services/auth/auth.service';
import { provideDataServices } from './core/services/data/data-providers';
import { PermissionService } from './core/services/permission.service';
import { ThemePreferenceService } from './core/services/theme-preference.service';

async function initializeApp(): Promise<void> {
  inject(ThemePreferenceService);
  const permissionService = inject(PermissionService);
  const authService = inject(AuthService);
  await permissionService.load();
  await authService.restoreSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideDataServices(environment.useMockData),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideAppInitializer(initializeApp),
  ],
};
