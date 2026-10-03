import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AppSettings } from '../../../models/domain/app-settings.model';
import { cloneValue } from '../../../utils/clone.util';
import { SettingsDataService } from '../settings-data.service';
import { SETTINGS_SEED } from './seed/settings.seed';

@Injectable()
export class InMemorySettingsDataService extends SettingsDataService {
  private settings: AppSettings = cloneValue(SETTINGS_SEED);

  get(): Observable<AppSettings> {
    return of(cloneValue(this.settings));
  }

  save(settings: AppSettings): Observable<AppSettings> {
    this.settings = cloneValue(settings);
    return of(cloneValue(this.settings));
  }
}
