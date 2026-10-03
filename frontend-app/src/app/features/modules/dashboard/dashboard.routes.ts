import { Routes } from '@angular/router';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    title: 'Dashboard',
    data: { module: ModuleKey.DASHBOARD },
    loadComponent: () => import('./dashboard.component').then(file => file.DashboardComponent),
  },
];
