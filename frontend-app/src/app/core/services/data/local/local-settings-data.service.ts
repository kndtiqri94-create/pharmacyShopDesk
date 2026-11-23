import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppSettings } from '../../../models/domain/app-settings.model';
import { cloneValue } from '../../../utils/clone.util';
import { SETTINGS_SEED } from '../in-memory/seed/settings.seed';
import { SettingsDataService } from '../settings-data.service';
import { LocalDatabaseProvider } from './local-database.provider';
import { DOCUMENT_IDS, readDocument, writeDocument } from './local-meta';

@Injectable()
export class LocalSettingsDataService extends SettingsDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  get(): Observable<AppSettings> {
    return this.databaseProvider.observe(async db => {
      const stored = await readDocument<AppSettings>(db, DOCUMENT_IDS.appSettings);
      return cloneValue(stored ?? SETTINGS_SEED);
    });
  }

  save(settings: AppSettings): Observable<AppSettings> {
    return this.databaseProvider.observe(async db => {
      await writeDocument(db, DOCUMENT_IDS.appSettings, cloneValue(settings));
      return cloneValue(settings);
    });
  }
}
