import { Routes } from '@angular/router';
import { moduleWriteGuard } from '../../../core/guards/module-write.guard';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

const loadForm = () => import('./grn-form/grn-form.component').then(file => file.GrnFormComponent);

export const GRN_ROUTES: Routes = [
  {
    path: '',
    title: 'GRN',
    data: { module: ModuleKey.GRN },
    loadComponent: () =>
      import('./grn-list/grn-list.component').then(file => file.GrnListComponent),
  },
  {
    path: 'new',
    title: 'New GRN',
    canActivate: [moduleWriteGuard],
    data: { module: ModuleKey.GRN, mode: 'create' },
    loadComponent: loadForm,
  },
  {
    path: ':id',
    title: 'GRN',
    data: { module: ModuleKey.GRN, mode: 'open' },
    loadComponent: loadForm,
  },
];
