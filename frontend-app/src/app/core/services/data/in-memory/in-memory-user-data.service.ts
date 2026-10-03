import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AppUser } from '../../../models/domain/app-user.model';
import { UserDataService } from '../user-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { USER_SEED } from './seed/user.seed';

@Injectable()
export class InMemoryUserDataService extends UserDataService {
  private readonly collection = new InMemoryCollection<AppUser>(USER_SEED);

  getAll(): Observable<readonly AppUser[]> {
    return of(this.collection.all());
  }

  getById(id: string): Observable<AppUser | null> {
    return of(this.collection.byId(id));
  }

  getByUsername(username: string): Observable<AppUser | null> {
    const normalized = username.trim().toLowerCase();
    const match = this.collection.all().find(user => user.username.toLowerCase() === normalized);
    return of(match ?? null);
  }

  save(user: AppUser): Observable<AppUser> {
    return of(this.collection.upsert(user));
  }
}
