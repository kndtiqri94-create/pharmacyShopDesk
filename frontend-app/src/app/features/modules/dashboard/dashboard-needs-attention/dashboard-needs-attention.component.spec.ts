import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import {
  NeedsAttentionRow,
  buildNeedsAttention,
} from '../../../../core/utils/dashboard-metrics.util';
import { DashboardNeedsAttentionComponent } from './dashboard-needs-attention.component';

describe('DashboardNeedsAttentionComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
  });

  afterEach(clearBrowserStorage);

  async function render(role: UserRole, rows: NeedsAttentionRow[]) {
    await signInAs(role);
    const fixture = TestBed.createComponent(DashboardNeedsAttentionComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says plainly that nothing needs attention when there are no rows', async () => {
    const element = await render(UserRole.ADMIN, []);
    expect(element.textContent).toContain('Nothing needs attention right now');
    expect(element.querySelector('button')).toBeNull();
  });

  it('never takes the person to a page they cannot open', async () => {
    const rows = buildNeedsAttention({
      needsRestock: 1,
      expiringBatches: 0,
      expireByDate: '2026-11-20',
      overdueOrders: 1,
      floatLow: false,
    });
    const element = await render(UserRole.CASHIER, rows);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons.every(button => button.disabled)).toBeTrue();
    buttons.forEach(button => button.click());
    expect(navigate).not.toHaveBeenCalled();
  });
});
