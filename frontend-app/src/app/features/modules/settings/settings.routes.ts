import { Routes } from '@angular/router';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Settings',
    data: { module: ModuleKey.SETTINGS },
    loadComponent: () => import('./settings.component').then(file => file.SettingsComponent),
  },
];
