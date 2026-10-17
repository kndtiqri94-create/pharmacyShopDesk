import { Routes } from '@angular/router';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    title: 'Employees',
    data: { module: ModuleKey.EMPLOYEES },
    loadComponent: () => import('./employees.component').then(file => file.EmployeesComponent),
  },
];
