import { Routes } from '@angular/router';
import { moduleWriteGuard } from '../../../core/guards/module-write.guard';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

const loadForm = () =>
  import('./product-form/product-form.component').then(file => file.ProductFormComponent);

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Products',
    data: { module: ModuleKey.PRODUCTS },
    loadComponent: () =>
      import('./product-list/product-list.component').then(file => file.ProductListComponent),
  },
  {
    path: 'new',
    title: 'Add product',
    canActivate: [moduleWriteGuard],
    data: { module: ModuleKey.PRODUCTS, mode: 'create' },
    loadComponent: loadForm,
  },
  {
    path: ':id/edit',
    title: 'Edit product',
    canActivate: [moduleWriteGuard],
    data: { module: ModuleKey.PRODUCTS, mode: 'edit' },
    loadComponent: loadForm,
  },
  {
    path: ':id',
    title: 'Product',
    data: { module: ModuleKey.PRODUCTS, mode: 'view' },
    loadComponent: loadForm,
  },
];
