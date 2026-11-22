import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import {
  TEST_TODAY,
  closeOpenDialogs,
  settle,
  testBill,
} from '../../../../../testing/pos-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosCashService } from '../../../../core/services/pos-cash.service';
import { PosSaleService } from '../../../../core/services/pos-sale.service';
import { DrawerEndDialogComponent } from './drawer-end-dialog.component';

describe('DrawerEndDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(canChange = true) {
    await signInAs(UserRole.CASHIER);
    await TestBed.inject(PosCashService).saveOpening('1000', false);
    await TestBed.inject(PosSaleService).save(
      testBill({ payments: { ...testBill().payments, cash: '20' } })
    );
    const fixture = TestBed.createComponent(DrawerEndDialogComponent);
    fixture.componentRef.setInput('canChange', canChange);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === label
      )!;
    return { fixture, element, button };
  }

  it('shows the closing cash expected as opening plus cash in minus cash out', async () => {
    const { element } = await render();
    expect(element.querySelector('[data-testid="drawer-expected"]')?.textContent).toContain(
      '1,010'
    );
  });

  it('asks before ending the drawer, and ends it once confirmed', async () => {
    const { fixture, element, button } = await render();
    button('End drawer').click();
    fixture.detectChanges();
    expect(element.textContent).toContain('End the drawer for today?');
    expect((await TestBed.inject(PosCashService).status(TEST_TODAY)).drawerEnded).toBeFalse();
    const confirm = Array.from(element.querySelectorAll('button')).filter(
      candidate => candidate.textContent?.trim() === 'End drawer'
    )[0];
    confirm.click();
    await settle(fixture);
    expect((await TestBed.inject(PosCashService).status(TEST_TODAY)).drawerEnded).toBeTrue();
    expect(element.textContent).toContain('Drawer ended');
  });

  it('can be kept open at the confirmation', async () => {
    const { fixture, element, button } = await render();
    button('End drawer').click();
    fixture.detectChanges();
    button('Keep it open').click();
    fixture.detectChanges();
    expect(element.textContent).not.toContain('End the drawer for today?');
    expect((await TestBed.inject(PosCashService).status(TEST_TODAY)).drawerEnded).toBeFalse();
  });

  it('cannot end the drawer for a user who cannot sell', async () => {
    const { button } = await render(false);
    expect(button('End drawer').disabled).toBeTrue();
  });
});
