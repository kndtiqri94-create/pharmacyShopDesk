import { Provider } from '@angular/core';
import { EmployeeDataService } from './employee-data.service';
import { GrnDataService } from './grn-data.service';
import { InMemoryEmployeeDataService } from './in-memory/in-memory-employee-data.service';
import { InMemoryGrnDataService } from './in-memory/in-memory-grn-data.service';
import { InMemoryProductDataService } from './in-memory/in-memory-product-data.service';
import { InMemoryPurchaseOrderDataService } from './in-memory/in-memory-purchase-order-data.service';
import { InMemoryReloadDataService } from './in-memory/in-memory-reload-data.service';
import { InMemoryRoleDataService } from './in-memory/in-memory-role-data.service';
import { InMemorySalesDataService } from './in-memory/in-memory-sales-data.service';
import { InMemorySettingsDataService } from './in-memory/in-memory-settings-data.service';
import { InMemorySupplierDataService } from './in-memory/in-memory-supplier-data.service';
import { InMemorySyncDataService } from './in-memory/in-memory-sync-data.service';
import { InMemoryUserDataService } from './in-memory/in-memory-user-data.service';
import { ProductDataService } from './product-data.service';
import { PurchaseOrderDataService } from './purchase-order-data.service';
import { ReloadDataService } from './reload-data.service';
import { RoleDataService } from './role-data.service';
import { SalesDataService } from './sales-data.service';
import { SettingsDataService } from './settings-data.service';
import { SupplierDataService } from './supplier-data.service';
import { SyncDataService } from './sync-data.service';
import { UserDataService } from './user-data.service';

type DataToken = abstract new () => object;

const IN_MEMORY_BINDINGS: readonly [DataToken, new () => object][] = [
  [ProductDataService, InMemoryProductDataService],
  [GrnDataService, InMemoryGrnDataService],
  [PurchaseOrderDataService, InMemoryPurchaseOrderDataService],
  [SupplierDataService, InMemorySupplierDataService],
  [EmployeeDataService, InMemoryEmployeeDataService],
  [UserDataService, InMemoryUserDataService],
  [RoleDataService, InMemoryRoleDataService],
  [ReloadDataService, InMemoryReloadDataService],
  [SettingsDataService, InMemorySettingsDataService],
  [SalesDataService, InMemorySalesDataService],
  [SyncDataService, InMemorySyncDataService],
];

function notConfigured(): never {
  throw new Error('A real data source is not configured yet.');
}

export function provideDataServices(useMockData: boolean): Provider[] {
  return IN_MEMORY_BINDINGS.map(([token, implementation]) =>
    useMockData
      ? { provide: token, useClass: implementation }
      : { provide: token, useFactory: notConfigured }
  );
}
