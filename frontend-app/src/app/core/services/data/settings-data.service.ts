import { Observable } from 'rxjs';
import { AppSettings } from '../../models/domain/app-settings.model';

export abstract class SettingsDataService {
  abstract get(): Observable<AppSettings>;
  abstract save(settings: AppSettings): Observable<AppSettings>;
}
