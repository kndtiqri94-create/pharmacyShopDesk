import { Routes } from '@angular/router';
import { moduleWriteGuard } from '../../../core/guards/module-write.guard';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

const loadForm = () =>
  import('./purchase-order-form/purchase-order-form.component').then(
    file => file.PurchaseOrderFormComponent
  );

export const PURCHASE_ORDERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Purchase orders',
    data: { module: ModuleKey.PURCHASE_ORDERS },
    loadComponent: () =>
      import('./purchase-order-list/purchase-order-list.component').then(
        file => file.PurchaseOrderListComponent
      ),
  },
  {
    path: 'new',
    title: 'New purchase order',
    canActivate: [moduleWriteGuard],
    data: { module: ModuleKey.PURCHASE_ORDERS, mode: 'create' },
    loadComponent: loadForm,
  },
  {
    path: ':id/edit',
    title: 'Edit purchase order',
    canActivate: [moduleWriteGuard],
    data: { module: ModuleKey.PURCHASE_ORDERS, mode: 'edit' },
    loadComponent: loadForm,
  },
  {
    path: ':id',
    title: 'Purchase order',
    data: { module: ModuleKey.PURCHASE_ORDERS, mode: 'view' },
    loadComponent: loadForm,
  },
];
