import { Observable } from 'rxjs';
import { RolePermissionMatrix } from '../../models/domain/role-permission-matrix.model';

export abstract class RoleDataService {
  abstract readonly matrix$: Observable<RolePermissionMatrix>;
  abstract getMatrix(): Observable<RolePermissionMatrix>;
  abstract saveMatrix(matrix: RolePermissionMatrix): Observable<RolePermissionMatrix>;
}
