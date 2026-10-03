import { Observable } from 'rxjs';
import { Employee } from '../../models/domain/employee.model';

export abstract class EmployeeDataService {
  abstract getAll(): Observable<readonly Employee[]>;
  abstract getById(id: string): Observable<Employee | null>;
  abstract save(employee: Employee): Observable<Employee>;
}
