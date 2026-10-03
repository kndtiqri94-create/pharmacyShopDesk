import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Employee } from '../../../models/domain/employee.model';
import { EmployeeDataService } from '../employee-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { EMPLOYEE_SEED } from './seed/employee.seed';

@Injectable()
export class InMemoryEmployeeDataService extends EmployeeDataService {
  private readonly collection = new InMemoryCollection<Employee>(EMPLOYEE_SEED);

  getAll(): Observable<readonly Employee[]> {
    return of(this.collection.all());
  }

  getById(id: string): Observable<Employee | null> {
    return of(this.collection.byId(id));
  }

  save(item: Employee): Observable<Employee> {
    return of(this.collection.upsert(item));
  }
}
