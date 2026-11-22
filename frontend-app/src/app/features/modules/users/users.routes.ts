import { Routes } from '@angular/router';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Users & roles',
    data: { module: ModuleKey.USERS },
    loadComponent: () => import('./users.component').then(file => file.UsersComponent),
  },
];
