import { Observable } from 'rxjs';
import { AppUser } from '../../models/domain/app-user.model';

export abstract class UserDataService {
  abstract getAll(): Observable<readonly AppUser[]>;
  abstract getById(id: string): Observable<AppUser | null>;
  abstract getByUsername(username: string): Observable<AppUser | null>;
  abstract save(user: AppUser): Observable<AppUser>;
}
