import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { posLeaveGuard } from './pos-leave.guard';
import { PosComponent } from './pos.component';

describe('posLeaveGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  function run(component: Pick<PosComponent, 'confirmLeave'>) {
    return TestBed.runInInjectionContext(() =>
      posLeaveGuard(component as PosComponent, route, state, state)
    );
  }

  it('lets the route change when the till allows it', () => {
    const confirmLeave = jasmine.createSpy('confirmLeave').and.returnValue(true);
    expect(run({ confirmLeave })).toBeTrue();
    expect(confirmLeave).toHaveBeenCalledTimes(1);
  });

  it('blocks the route change when the till says to stay', async () => {
    const confirmLeave = jasmine.createSpy('confirmLeave').and.resolveTo(false);
    expect(await run({ confirmLeave })).toBeFalse();
  });
});
