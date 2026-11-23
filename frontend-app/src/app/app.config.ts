import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { TitleStrategy, provideRouter } from '@angular/router';
import { environment } from '@environments/environment';
import { routes } from './app.routes';
import { apiAuthInterceptor } from './core/interceptors/api-auth.interceptor';
import { AppTitleStrategy } from './core/services/app-title.strategy';
import { AuthService } from './core/services/auth/auth.service';
import { provideDataServices } from './core/services/data/data-providers';
import { LocalDatabaseProvider } from './core/services/data/local/local-database.provider';
import { LocalStorageUnavailableError } from './core/services/data/local/local-storage-unavailable.error';
import { SyncEngineService } from './core/services/data/local/sync/sync-engine.service';
import { PermissionService } from './core/services/permission.service';
import { ThemePreferenceService } from './core/services/theme-preference.service';

async function initializeApp(): Promise<void> {
  inject(ThemePreferenceService);
  const permissionService = inject(PermissionService);
  const authService = inject(AuthService);
  const localDatabaseProvider = inject(LocalDatabaseProvider);
  const syncEngine = inject(SyncEngineService);
  if (environment.dataSource === 'local') {
    await localDatabaseProvider.ready().catch(() => {
      throw new LocalStorageUnavailableError();
    });
    syncEngine.start();
  }
  await permissionService.load();
  await authService.restoreSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([apiAuthInterceptor])),
    provideDataServices(environment.dataSource),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideAppInitializer(initializeApp),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
