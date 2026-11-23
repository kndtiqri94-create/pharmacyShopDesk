import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppUser } from '../../../models/domain/app-user.model';
import { UserDataService } from '../user-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';
import { sanitizeUser } from './local-user-sanitizer';

@Injectable()
export class LocalUserDataService extends UserDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getAll(): Observable<readonly AppUser[]> {
    return this.databaseProvider.observe(db => new LocalCollection<AppUser>(db.users).all());
  }

  getById(id: string): Observable<AppUser | null> {
    return this.databaseProvider.observe(db => new LocalCollection<AppUser>(db.users).byId(id));
  }

  getByUsername(username: string): Observable<AppUser | null> {
    const normalized = username.trim().toLowerCase();
    return this.databaseProvider.observe(async db => {
      const users = await new LocalCollection<AppUser>(db.users).all();
      return users.find(user => user.username.toLowerCase() === normalized) ?? null;
    });
  }

  save(user: AppUser): Observable<AppUser> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.users, () =>
        new LocalCollection<AppUser>(db.users).upsert(sanitizeUser(user))
      )
    );
  }
}
