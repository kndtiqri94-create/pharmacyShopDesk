import { Routes } from '@angular/router';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { posLeaveGuard } from './pos-leave.guard';

export const POS_ROUTES: Routes = [
  {
    path: '',
    title: 'POS',
    data: { module: ModuleKey.POS },
    canDeactivate: [posLeaveGuard],
    loadComponent: () => import('./pos.component').then(file => file.PosComponent),
  },
];
