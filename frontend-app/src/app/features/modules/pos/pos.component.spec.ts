import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { AuthService } from '../../../core/services/auth/auth.service';
import { RoleDataService } from '../../../core/services/data/role-data.service';
import { SalesDataService } from '../../../core/services/data/sales-data.service';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PosFullscreenService } from '../../../core/services/pos-fullscreen.service';
import { PosService } from '../../../core/services/pos.service';
import { ShellStateService } from '../../../core/services/shell-state.service';
import { PosComponent } from './pos.component';

@Component({ template: '', selector: 'app-blank' })
class BlankComponent {}

describe('PosComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    TestBed.inject(NotificationService).dismiss();
    for (const dialog of Array.from(document.querySelectorAll('dialog[open]'))) {
      (dialog as HTMLDialogElement).close();
    }
    clearBrowserStorage();
  });

  async function settle(fixture: { detectChanges(): void }, ms = 40): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
    fixture.detectChanges();
  }

  async function render(
    options: { role?: UserRole; hideSidebar?: boolean; viewOnly?: boolean } = {}
  ) {
    const fullscreen = {
      supported: true,
      isFullscreen: signal(false),
      toggle: jasmine.createSpy('toggle').and.resolveTo(),
    };
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([
          { path: 'dashboard', component: BlankComponent },
          { path: 'products', component: BlankComponent },
          { path: 'sign-in', component: BlankComponent },
        ]),
      ],
    });
    TestBed.overrideComponent(PosComponent, {
      set: { providers: [{ provide: PosFullscreenService, useValue: fullscreen }] },
    });
    await signInAs(options.role ?? UserRole.CASHIER);
    if (options.viewOnly) {
      await TestBed.inject(PermissionService).load();
      const roleDataService = TestBed.inject(RoleDataService);
      const matrix = await firstValueFrom(roleDataService.getMatrix());
      const role = options.role ?? UserRole.CASHIER;
      await firstValueFrom(
        roleDataService.saveMatrix({ ...matrix, [role]: { ...matrix[role], pos: 'VIEW' } })
      );
    }
    if (options.hideSidebar !== undefined) {
      const settingsDataService = TestBed.inject(SettingsDataService);
      const current = await firstValueFrom(settingsDataService.get());
      await firstValueFrom(
        settingsDataService.save({ ...current, posHideSidebar: options.hideSidebar })
      );
    }
    const fixture = TestBed.createComponent(PosComponent);
    fixture.detectChanges();
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const pos = TestBed.inject(PosService);
    const press = (key: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true, ...init });
      document.dispatchEvent(event);
      return event;
    };
    const fillBill = () => {
      pos.addProduct('prod-001');
      pos.setQuantity('prod-001', '4');
      pos.setPaymentText('cash', '10');
      fixture.detectChanges();
    };
    const message = () => TestBed.inject(NotificationService).current()?.message;
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(candidate =>
        candidate.textContent?.trim().startsWith(label)
      )!;
    const confirmDialog = () =>
      element.querySelector('app-confirm-dialog dialog') as HTMLDialogElement;
    return { fixture, element, pos, press, fillBill, message, button, confirmDialog, fullscreen };
  }

  describe('the till screen', () => {
    it('shows the header, bill header, items, totals, payment and actions', async () => {
      const { element } = await render();
      for (const selector of [
        'app-pos-header',
        'app-pos-bill-header',
        'app-pos-product-search',
        'app-pos-bill-lines',
        'app-pos-totals',
        'app-pos-payment',
        'app-pos-actions',
      ]) {
        expect(element.querySelector(selector)).withContext(selector).not.toBeNull();
      }
    });

    it('does not go full screen on its own and offers the toggle', async () => {
      const { fullscreen, button } = await render();
      expect(fullscreen.toggle).not.toHaveBeenCalled();
      expect(button('Enter full screen')).toBeDefined();
    });

    it('has no Phase B bottom bar buttons, not even disabled ones', async () => {
      const { element } = await render();
      const text = element.textContent ?? '';
      for (const phaseB of ['Last Invoice', 'Quotation', 'Cash Book', 'Counter Close', 'Drawer']) {
        expect(text).withContext(phaseB).not.toContain(phaseB);
      }
    });

    it('makes every button at least 52px, dialogs included', async () => {
      const { element } = await render();
      const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button'));
      expect(buttons.length).toBeGreaterThan(10);
      for (const candidate of buttons) {
        expect(parseFloat(getComputedStyle(candidate).minHeight))
          .withContext(candidate.textContent ?? '')
          .toBeGreaterThanOrEqual(52);
      }
    });

    it('shows a view only message and no way to sell for someone who cannot sell', async () => {
      const { element, pos, button } = await render({ viewOnly: true });
      expect(element.textContent).toContain('View only');
      expect(pos.canSell()).toBeFalse();
      expect(button('Save & print').disabled).toBeTrue();
      expect(button('Hold bill').disabled).toBeTrue();
    });

    it('shows no view only message to someone who can sell', async () => {
      const { element } = await render();
      expect(element.textContent).not.toContain('View only');
    });
  });

  describe('the sidebar', () => {
    it('is hidden when the till opens while Hide sidebar when POS opens is on', async () => {
      await render({ hideSidebar: true });
      expect(TestBed.inject(ShellStateService).sidebarHidden()).toBeTrue();
    });

    it('stays when the option is off', async () => {
      await render({ hideSidebar: false });
      expect(TestBed.inject(ShellStateService).sidebarHidden()).toBeFalse();
    });

    it('comes back when the till is left', async () => {
      const { fixture } = await render({ hideSidebar: true });
      fixture.destroy();
      expect(TestBed.inject(ShellStateService).sidebarHidden()).toBeFalse();
    });
  });

  describe('shortcut keys', () => {
    it('F3, F4 and F7 pick Cash, Card and Online and stop the browser handling the key', async () => {
      const { press, pos, fixture } = await render();
      expect(press('F4').defaultPrevented).toBeTrue();
      fixture.detectChanges();
      expect(pos.activePaymentField()).toBe('card');
      expect(press('F7').defaultPrevented).toBeTrue();
      expect(pos.activePaymentField()).toBe('online');
      expect(press('F3').defaultPrevented).toBeTrue();
      expect(pos.activePaymentField()).toBe('cash');
    });

    it('F2 saves the sale and opens a new empty bill', async () => {
      const { fixture, press, fillBill, pos, message } = await render();
      fillBill();
      press('F2');
      await settle(fixture);
      expect(message()).toBe('Sale INV-0001 saved.');
      expect(pos.bill().lines).toEqual([]);
      expect(pos.bill().invoiceNo).toBe('INV-0002');
      const sales = await firstValueFrom(TestBed.inject(SalesDataService).getSales());
      expect(sales).toHaveSize(1);
    });

    it('F1 saves the sale and opens the printable receipt', async () => {
      const { fixture, element, press, fillBill } = await render();
      fillBill();
      press('F1');
      await settle(fixture);
      const sheet = element.querySelector('app-pos-receipt .sd-receipt-sheet');
      expect(sheet).not.toBeNull();
      expect(sheet?.textContent).toContain('INV-0001');
      expect(sheet?.textContent).toContain('Paracetamol 500mg');
    });

    it('F10 holds the bill under a hold number and opens a fresh one', async () => {
      const { fixture, press, fillBill, pos, message } = await render();
      fillBill();
      press('F10');
      await settle(fixture);
      expect(message()).toBe('Bill held as H-001.');
      expect(pos.heldBills()).toHaveSize(1);
      expect(pos.bill().lines).toEqual([]);
    });

    it('F12 asks first when the bill has unsaved items, and starts a new bill when it has none', async () => {
      const { fixture, press, fillBill, confirmDialog, pos } = await render();
      press('F12');
      await settle(fixture);
      expect(pos.bill().invoiceNo).toBe('INV-0002');
      expect(confirmDialog().open).toBeFalse();
      fillBill();
      press('F12');
      fixture.detectChanges();
      expect(confirmDialog().open).toBeTrue();
      expect(pos.bill().lines).toHaveSize(1);
    });

    it('does nothing for an empty bill but says why', async () => {
      const { fixture, press, message } = await render();
      press('F2');
      await settle(fixture);
      expect(message()).toContain('no items');
    });

    it('leaves every other key to the browser', async () => {
      const { press } = await render();
      for (const key of ['F5', 'F6', 'F11', 'Enter', 'a']) {
        expect(press(key).defaultPrevented).withContext(key).toBeFalse();
      }
    });

    it('ignores a held-down key and a key pressed while a dialog is open', async () => {
      const { fixture, press, fillBill, pos, button } = await render();
      fillBill();
      press('F10', { repeat: true });
      await settle(fixture);
      expect(pos.heldBills()).toHaveSize(0);
      button('Held bills').click();
      fixture.detectChanges();
      press('F10');
      await settle(fixture);
      expect(pos.heldBills()).toHaveSize(0);
      expect(pos.bill().lines).toHaveSize(1);
    });

    it('stops working when the till is not the page on screen', async () => {
      const { fixture, press, fillBill, pos } = await render();
      fillBill();
      fixture.destroy();
      const event = press('F2');
      await new Promise(resolve => setTimeout(resolve, 40));
      expect(event.defaultPrevented).toBeFalse();
      const sales = await firstValueFrom(TestBed.inject(SalesDataService).getSales());
      expect(sales).toHaveSize(0);
      expect(pos.heldBills()).toHaveSize(0);
    });
  });

  describe('keeping an unsaved bill safe', () => {
    it('lets you leave straight away when there is nothing unsaved', async () => {
      const { fixture } = await render();
      expect(fixture.componentInstance.confirmLeave()).toBeTrue();
    });

    it('asks before leaving with unsaved items, and stays when you choose to stay', async () => {
      const { fixture, fillBill, confirmDialog, button, pos } = await render();
      fillBill();
      const decision = fixture.componentInstance.confirmLeave() as Promise<boolean>;
      fixture.detectChanges();
      expect(confirmDialog().open).toBeTrue();
      button('Stay on the till').click();
      fixture.detectChanges();
      expect(await decision).toBeFalse();
      expect(pos.bill().lines).toHaveSize(1);
    });

    it('leaves without a prompt and clears the bill once the user has signed out', async () => {
      const { fixture, fillBill, confirmDialog, pos } = await render();
      fillBill();
      await TestBed.inject(AuthService).signOut();
      const result = fixture.componentInstance.confirmLeave();
      fixture.detectChanges();
      expect(result).toBeTrue();
      expect(confirmDialog().open).toBeFalse();
      expect(pos.bill().lines).toHaveSize(0);
    });

    it('leaves and clears the bill when you choose to leave', async () => {
      const { fixture, fillBill, button } = await render();
      fillBill();
      const decision = fixture.componentInstance.confirmLeave() as Promise<boolean>;
      fixture.detectChanges();
      button('Leave and clear').click();
      fixture.detectChanges();
      expect(await decision).toBeTrue();
    });

    it('asks before Refresh and loses nothing if you keep the bill', async () => {
      const { fixture, fillBill, confirmDialog, button, pos } = await render();
      fillBill();
      button('Refresh').click();
      fixture.detectChanges();
      expect(confirmDialog().open).toBeTrue();
      button('Keep this bill').click();
      fixture.detectChanges();
      expect(pos.bill().lines).toHaveSize(1);
      expect(confirmDialog().open).toBeFalse();
    });

    it('clears the bill when you confirm Refresh', async () => {
      const { fixture, fillBill, button, pos } = await render();
      fillBill();
      button('Refresh').click();
      fixture.detectChanges();
      button('Refresh and clear').click();
      await settle(fixture);
      expect(pos.bill().lines).toEqual([]);
    });

    it('asks before Create new bill when the bill has unsaved items', async () => {
      const { fixture, fillBill, confirmDialog, button, pos } = await render();
      fillBill();
      button('Create new bill').click();
      fixture.detectChanges();
      expect(confirmDialog().open).toBeTrue();
      button('Keep this bill').click();
      fixture.detectChanges();
      expect(pos.bill().lines).toHaveSize(1);
      button('Create new bill').click();
      fixture.detectChanges();
      button('Clear and start new').click();
      await settle(fixture);
      expect(pos.bill().lines).toEqual([]);
      expect(pos.bill().invoiceNo).toBe('INV-0002');
    });

    it('goes back to the Dashboard from Back to back office', async () => {
      const { fixture } = await render({ role: UserRole.MANAGER });
      const router = TestBed.inject(Router);
      const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
      Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(candidate => candidate.textContent?.includes('Back to back office'))!
        .click();
      expect(navigate).toHaveBeenCalledWith('/dashboard');
    });

    it('goes to the first page a role can use when it has no Dashboard', async () => {
      const { fixture } = await render({ role: UserRole.CASHIER });
      const router = TestBed.inject(Router);
      const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
      Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(candidate => candidate.textContent?.includes('Back to back office'))!
        .click();
      expect(navigate).toHaveBeenCalledWith('/products');
    });

    it('warns the browser before the tab is closed or reloaded with unsaved items only', async () => {
      const { fillBill } = await render();
      const clean = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(clean);
      expect(clean.defaultPrevented).toBeFalse();
      fillBill();
      const unsaved = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unsaved);
      expect(unsaved.defaultPrevented).toBeTrue();
    });
  });

  describe('held bills', () => {
    it('lists held bills and resumes one with its lines back', async () => {
      const { fixture, element, fillBill, press, button, pos, message } = await render();
      fillBill();
      press('F10');
      await settle(fixture);
      button('Held bills').click();
      fixture.detectChanges();
      const dialog = element.querySelector('app-held-bills-dialog dialog') as HTMLDialogElement;
      expect(dialog.open).toBeTrue();
      const resume = element.querySelector(
        'button[aria-label="Resume H-001"]'
      ) as HTMLButtonElement;
      resume.click();
      await settle(fixture);
      expect(pos.bill().lines).toHaveSize(1);
      expect(pos.heldBills()).toHaveSize(0);
      expect(dialog.open).toBeFalse();
      expect(message()).toContain('Held bill resumed.');
    });
  });

  describe('discount approval', () => {
    async function openApprovalForLine() {
      const context = await render();
      context.fillBill();
      const discount = context.element.querySelector(
        'input[aria-label^="Discount percent"]'
      ) as HTMLInputElement;
      discount.value = '10';
      discount.dispatchEvent(new Event('change'));
      context.fixture.detectChanges();
      const dialog = context.element.querySelector(
        'app-discount-approval-dialog dialog'
      ) as HTMLDialogElement;
      const username = context.element.querySelector('#approval-username') as HTMLInputElement;
      const password = context.element.querySelector('#approval-password') as HTMLInputElement;
      const submit = async (user: string, pass: string) => {
        username.value = user;
        password.value = pass;
        context.element
          .querySelector('app-discount-approval-dialog form')!
          .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await settle(context.fixture, 120);
      };
      return { ...context, dialog, username, password, submit, discount };
    }

    it('opens the Admin dialog for a changed line discount and applies it after a valid Admin signs in', async () => {
      const { dialog, submit, pos, message, password } = await openApprovalForLine();
      expect(dialog.open).toBeTrue();
      expect(pos.bill().lines[0].discountPercent).toBe(0);
      await submit('nimal', 'Owner@2026');
      expect(pos.bill().lines[0].discountPercent).toBe(10);
      expect(pos.bill().lines[0].discountApproval?.approverName).toBe('Nimal Perera');
      expect(dialog.open).toBeFalse();
      expect(message()).toBe('Discount approved by Nimal Perera.');
      expect(password.value).toBe('');
    });

    it('puts the discount back to the default with a message for wrong credentials', async () => {
      const { dialog, submit, pos, message, password } = await openApprovalForLine();
      await submit('nimal', 'wrong-password');
      expect(pos.bill().lines[0].discountPercent).toBe(0);
      expect(dialog.open).toBeFalse();
      expect(message()).toContain('sign-in details were not accepted');
      expect(password.value).toBe('');
    });

    it('puts the discount back to the default for a Manager and says an active Admin is needed', async () => {
      const { submit, pos, message } = await openApprovalForLine();
      await submit('kamal', 'Manager@2026');
      expect(pos.bill().lines[0].discountPercent).toBe(0);
      expect(message()).toContain('active Admin account');
    });

    it('puts the discount back to the default when the dialog is cancelled', async () => {
      const { dialog, fixture, pos, message, element } = await openApprovalForLine();
      const cancel = Array.from(
        element.querySelectorAll<HTMLButtonElement>('app-discount-approval-dialog button')
      ).find(candidate => candidate.textContent?.trim() === 'Cancel')!;
      cancel.click();
      fixture.detectChanges();
      expect(pos.bill().lines[0].discountPercent).toBe(0);
      expect(dialog.open).toBeFalse();
      expect(message()).toContain('not approved');
    });

    it('does not open the dialog for a discount above the maximum', async () => {
      const { fixture, element, fillBill } = await render();
      fillBill();
      const discount = element.querySelector(
        'input[aria-label^="Discount percent"]'
      ) as HTMLInputElement;
      discount.value = '25';
      discount.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      const dialog = element.querySelector(
        'app-discount-approval-dialog dialog'
      ) as HTMLDialogElement;
      expect(dialog.open).toBeFalse();
    });

    it('asks again for a bill discount even when an Admin is signed in', async () => {
      const { fixture, element, fillBill } = await render({ role: UserRole.ADMIN });
      fillBill();
      const percent = element.querySelector('#pos-discount-percent') as HTMLInputElement;
      percent.value = '5';
      percent.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      const dialog = element.querySelector(
        'app-discount-approval-dialog dialog'
      ) as HTMLDialogElement;
      expect(dialog.open).toBeTrue();
      expect(element.textContent).toContain('bill discount of 5%');
    });
  });
});
