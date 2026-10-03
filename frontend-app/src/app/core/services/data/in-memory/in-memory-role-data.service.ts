import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { RolePermissionMatrix } from '../../../models/domain/role-permission-matrix.model';
import { cloneValue } from '../../../utils/clone.util';
import { RoleDataService } from '../role-data.service';
import { ROLE_PERMISSION_SEED } from './seed/role-permission.seed';

@Injectable()
export class InMemoryRoleDataService extends RoleDataService {
  private readonly matrixSubject = new BehaviorSubject<RolePermissionMatrix>(
    cloneValue(ROLE_PERMISSION_SEED)
  );

  readonly matrix$: Observable<RolePermissionMatrix> = this.matrixSubject
    .asObservable()
    .pipe(map(matrix => cloneValue(matrix)));

  getMatrix(): Observable<RolePermissionMatrix> {
    return of(cloneValue(this.matrixSubject.value));
  }

  saveMatrix(matrix: RolePermissionMatrix): Observable<RolePermissionMatrix> {
    this.matrixSubject.next(cloneValue(matrix));
    return of(cloneValue(matrix));
  }
}
