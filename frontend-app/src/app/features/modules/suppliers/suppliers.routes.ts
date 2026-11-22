import { Routes } from '@angular/router';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

export const SUPPLIERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Suppliers',
    data: { module: ModuleKey.SUPPLIERS },
    loadComponent: () => import('./suppliers.component').then(file => file.SuppliersComponent),
  },
];
