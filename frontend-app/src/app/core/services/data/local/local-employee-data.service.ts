import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Employee } from '../../../models/domain/employee.model';
import { EmployeeDataService } from '../employee-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalEmployeeDataService extends EmployeeDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getAll(): Observable<readonly Employee[]> {
    return this.databaseProvider.observe(db => new LocalCollection<Employee>(db.employees).all());
  }

  getById(id: string): Observable<Employee | null> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<Employee>(db.employees).byId(id)
    );
  }

  save(employee: Employee): Observable<Employee> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.employees, () =>
        new LocalCollection<Employee>(db.employees).upsert(employee)
      )
    );
  }

  delete(id: string): Observable<boolean> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.outbox, db.employees, () =>
        new LocalCollection<Employee>(db.employees).remove(id)
      )
    );
  }
}
