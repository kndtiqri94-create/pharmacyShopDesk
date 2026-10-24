import { CanDeactivateFn } from '@angular/router';
import { PosComponent } from './pos.component';

export const posLeaveGuard: CanDeactivateFn<PosComponent> = component => component.confirmLeave();
