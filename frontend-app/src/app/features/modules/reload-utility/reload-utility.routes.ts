import { Routes } from '@angular/router';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

export const RELOAD_UTILITY_ROUTES: Routes = [
  {
    path: '',
    title: 'Reload & utility',
    data: { module: ModuleKey.RELOAD_UTILITY },
    loadComponent: () =>
      import('./reload-utility.component').then(file => file.ReloadUtilityComponent),
  },
];
