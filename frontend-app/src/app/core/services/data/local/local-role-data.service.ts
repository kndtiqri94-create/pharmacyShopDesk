import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { RolePermissionMatrix } from '../../../models/domain/role-permission-matrix.model';
import { cloneValue } from '../../../utils/clone.util';
import { ROLE_PERMISSION_SEED } from '../in-memory/seed/role-permission.seed';
import { RoleDataService } from '../role-data.service';
import { LocalDatabaseProvider } from './local-database.provider';
import { DOCUMENT_IDS, readDocument, writeDocument } from './local-meta';

@Injectable()
export class LocalRoleDataService extends RoleDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);
  private readonly matrixSubject = new BehaviorSubject<RolePermissionMatrix>(
    cloneValue(ROLE_PERMISSION_SEED)
  );

  readonly matrix$: Observable<RolePermissionMatrix> = this.matrixSubject
    .asObservable()
    .pipe(map(matrix => cloneValue(matrix)));

  constructor() {
    super();
    this.databaseProvider
      .run(db => readDocument<RolePermissionMatrix>(db, DOCUMENT_IDS.roleMatrix))
      .then(stored => {
        if (stored === undefined) return;
        if (JSON.stringify(stored) === JSON.stringify(this.matrixSubject.value)) return;
        this.matrixSubject.next(cloneValue(stored));
      })
      .catch(() => undefined);
  }

  getMatrix(): Observable<RolePermissionMatrix> {
    return this.databaseProvider.observe(async db => {
      const stored = await readDocument<RolePermissionMatrix>(db, DOCUMENT_IDS.roleMatrix);
      return cloneValue(stored ?? ROLE_PERMISSION_SEED);
    });
  }

  saveMatrix(matrix: RolePermissionMatrix): Observable<RolePermissionMatrix> {
    return this.databaseProvider.observe(async db => {
      await writeDocument(db, DOCUMENT_IDS.roleMatrix, cloneValue(matrix));
      this.matrixSubject.next(cloneValue(matrix));
      return cloneValue(matrix);
    });
  }
}
