import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { LocalStorageUnavailableError } from './app/core/services/data/local/local-storage-unavailable.error';

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  document.body.textContent =
    error instanceof LocalStorageUnavailableError
      ? error.message
      : 'ShopDesk could not start. Reload the page and try again.';
});
