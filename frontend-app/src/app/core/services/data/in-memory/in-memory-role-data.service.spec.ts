import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { RolePermissionMatrix } from '../../../models/domain/role-permission-matrix.model';
import { ModuleKey } from '../../../models/enums/module-key.enum';
import { PermissionLevel } from '../../../models/enums/permission-level.enum';
import { UserRole } from '../../../models/enums/user-role.enum';
import { provideDataServices } from '../data-providers';
import { RoleDataService } from '../role-data.service';

describe('InMemoryRoleDataService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  it('matches the documented permission matrix', async () => {
    const matrix = await firstValueFrom(TestBed.inject(RoleDataService).getMatrix());
    expect(Object.values(matrix[UserRole.ADMIN]).every(level => level === 'FULL')).toBeTrue();
    expect(matrix[UserRole.MANAGER]).toEqual({
      dashboard: 'FULL',
      products: 'FULL',
      grn: 'FULL',
      'purchase-orders': 'FULL',
      suppliers: 'FULL',
      employees: 'VIEW',
      'reload-utility': 'FULL',
      users: 'NONE',
      settings: 'NONE',
    });
    expect(matrix[UserRole.PHARMACIST]).toEqual({
      dashboard: 'VIEW',
      products: 'FULL',
      grn: 'FULL',
      'purchase-orders': 'VIEW',
      suppliers: 'VIEW',
      employees: 'NONE',
      'reload-utility': 'VIEW',
      users: 'NONE',
      settings: 'NONE',
    });
    expect(matrix[UserRole.CASHIER]).toEqual({
      dashboard: 'NONE',
      products: 'VIEW',
      grn: 'NONE',
      'purchase-orders': 'NONE',
      suppliers: 'NONE',
      employees: 'NONE',
      'reload-utility': 'FULL',
      users: 'NONE',
      settings: 'NONE',
    });
  });

  it('emits a new matrix to subscribers when it is saved', async () => {
    const service = TestBed.inject(RoleDataService);
    const seen: RolePermissionMatrix[] = [];
    const subscription = service.matrix$.subscribe(matrix => seen.push(matrix));
    const current = await firstValueFrom(service.getMatrix());
    const changed: RolePermissionMatrix = {
      ...current,
      CASHIER: { ...current.CASHIER, [ModuleKey.DASHBOARD]: PermissionLevel.VIEW },
    };
    await firstValueFrom(service.saveMatrix(changed));
    subscription.unsubscribe();
    expect(seen).toHaveSize(2);
    expect(seen[1].CASHIER.dashboard).toBe('VIEW');
  });

  it('hands out copies so callers cannot edit the stored matrix', async () => {
    const service = TestBed.inject(RoleDataService);
    const first = (await firstValueFrom(service.getMatrix())) as {
      CASHIER: Record<string, string>;
    };
    first.CASHIER['settings'] = 'FULL';
    expect((await firstValueFrom(service.getMatrix())).CASHIER.settings).toBe('NONE');
  });
});
