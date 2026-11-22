import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { posLeaveGuard } from './pos-leave.guard';
import { POS_ROUTES } from './pos.routes';

describe('POS_ROUTES', () => {
  it('has one lazy till route tied to the POS module', () => {
    expect(POS_ROUTES).toHaveSize(1);
    const [route] = POS_ROUTES;
    expect(route.path).toBe('');
    expect(route.data?.['module']).toBe(ModuleKey.POS);
    expect(route.loadComponent).toBeDefined();
  });

  it('protects an unsaved bill with the leave guard', () => {
    expect(POS_ROUTES[0].canDeactivate).toEqual([posLeaveGuard]);
  });
});
