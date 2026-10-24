import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { DiscountChangeRequest } from '../../../../core/services/pos-discount-approval.service';
import { DiscountDialogResult } from '../discount-dialog-result.model';
import { DiscountApprovalDialogComponent } from './discount-approval-dialog.component';

const REQUEST: DiscountChangeRequest = { scope: 'LINE', productId: 'prod-001', percent: 10 };

describe('DiscountApprovalDialogComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => clearBrowserStorage());

  async function render(role: UserRole = UserRole.CASHIER) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(DiscountApprovalDialogComponent);
    fixture.componentRef.setInput('request', REQUEST);
    fixture.componentRef.setInput('open', true);
    const results: DiscountDialogResult[] = [];
    fixture.componentInstance.finished.subscribe(result => results.push(result));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    const username = element.querySelector('#approval-username') as HTMLInputElement;
    const password = element.querySelector('#approval-password') as HTMLInputElement;
    const fill = (user: string, pass: string) => {
      username.value = user;
      password.value = pass;
    };
    const submit = async () => {
      element
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 30));
      fixture.detectChanges();
    };
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(candidate =>
        candidate.textContent?.includes(label)
      )!;
    return { fixture, element, dialog, username, password, fill, submit, button, results };
  }

  afterEach(() => {
    for (const dialog of Array.from(document.querySelectorAll('dialog[open]'))) {
      (dialog as HTMLDialogElement).close();
    }
  });

  describe('opening', () => {
    it('opens as a modal dialog and moves focus inside it', async () => {
      const { dialog } = await render();
      expect(dialog.open).toBeTrue();
      expect(dialog.matches(':modal')).toBeTrue();
      expect(dialog.contains(document.activeElement)).toBeTrue();
    });

    it('is labelled by its title and says what is being approved', async () => {
      const { dialog, element } = await render();
      const title = element.querySelector('h2') as HTMLElement;
      expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
      expect(title.textContent).toBe('Admin approval needed');
      expect(element.textContent).toContain('item discount of 10%');
    });

    it('hides the password while it is typed and never stores it in the browser', async () => {
      const { password, username } = await render();
      expect(password.type).toBe('password');
      expect(password.autocomplete).toBe('off');
      expect(username.autocomplete).toBe('off');
    });

    it('limits how much can be typed', async () => {
      const { password, username } = await render();
      expect(password.getAttribute('maxlength')).toBe('100');
      expect(username.getAttribute('maxlength')).toBe('100');
    });

    it('uses controls that are at least 52px', async () => {
      const { element } = await render();
      for (const candidate of Array.from(element.querySelectorAll('button'))) {
        expect(parseFloat(getComputedStyle(candidate).minHeight)).toBeGreaterThanOrEqual(52);
      }
      for (const box of Array.from(element.querySelectorAll('.sd-field-box'))) {
        expect(parseFloat(getComputedStyle(box).minHeight)).toBeGreaterThanOrEqual(52);
      }
    });
  });

  describe('approving', () => {
    it('accepts an active Admin, hands back the approval and clears both fields', async () => {
      const { fill, submit, results, username, password } = await render();
      fill('nimal', 'Owner@2026');
      await submit();
      expect(results).toHaveSize(1);
      const result = results[0];
      expect(result.kind).toBe('APPROVED');
      if (result.kind === 'APPROVED') {
        expect(result.approval.approverName).toBe('Nimal Perera');
        expect(result.approval.percent).toBe(10);
        expect(JSON.stringify(result.approval)).not.toContain('Owner@2026');
      }
      expect(password.value).toBe('');
      expect(username.value).toBe('');
    });

    it('accepts an Admin even when the Admin is the one signed in, because it always asks', async () => {
      const { fill, submit, results } = await render(UserRole.ADMIN);
      await submit();
      expect(results[0].kind).toBe('REJECTED');
      fill('nimal', 'Owner@2026');
      await submit();
      expect(results[1].kind).toBe('APPROVED');
    });

    it('rejects a wrong password with a message and clears the fields', async () => {
      const { fill, submit, results, password, username } = await render();
      fill('nimal', 'not-the-password');
      await submit();
      expect(results).toHaveSize(1);
      expect(results[0].kind).toBe('REJECTED');
      expect(results[0].kind === 'REJECTED' && results[0].message).toContain(
        'sign-in details were not accepted'
      );
      expect(results[0].kind === 'REJECTED' && results[0].message).toContain('default');
      expect(password.value).toBe('');
      expect(username.value).toBe('');
    });

    it('rejects a Manager, Pharmacist or Cashier saying an active Admin is needed', async () => {
      for (const [user, pass] of [
        ['kamal', 'Manager@2026'],
        ['dilani', 'Pharmacist@2026'],
        ['ruwani', 'Cashier@2026'],
      ]) {
        TestBed.resetTestingModule();
        const { fill, submit, results, password } = await render();
        fill(user, pass);
        await submit();
        expect(results[0].kind === 'REJECTED' && results[0].message).toContain(
          'active Admin account'
        );
        expect(password.value).toBe('');
      }
    });

    it('checks nothing and rejects when both fields are empty', async () => {
      const { submit, results } = await render();
      await submit();
      expect(results).toHaveSize(1);
      expect(results[0].kind).toBe('REJECTED');
    });
  });

  describe('cancelling', () => {
    it('Cancel says the change was not approved and clears the fields', async () => {
      const { fill, button, results, password, username } = await render();
      fill('nimal', 'Owner@2026');
      button('Cancel').click();
      expect(results).toHaveSize(1);
      expect(results[0].kind === 'REJECTED' && results[0].message).toContain('not approved');
      expect(password.value).toBe('');
      expect(username.value).toBe('');
    });

    it('Esc is a cancel too, and is stopped from closing the dialog on its own', async () => {
      const { fill, dialog, results, password } = await render();
      fill('nimal', 'Owner@2026');
      const escape = new Event('cancel', { cancelable: true });
      dialog.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBeTrue();
      expect(results).toHaveSize(1);
      expect(results[0].kind === 'REJECTED' && results[0].message).toContain('not approved');
      expect(password.value).toBe('');
    });
  });

  describe('closing from outside', () => {
    it('closes the dialog and clears a typed password when the till closes it', async () => {
      const { fixture, fill, dialog, password } = await render();
      fill('nimal', 'secret-typed');
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      expect(dialog.open).toBeFalse();
      expect(password.value).toBe('');
    });

    it('clears a typed password when it is destroyed', async () => {
      const { fixture, fill, password } = await render();
      fill('nimal', 'secret-typed');
      fixture.destroy();
      expect(password.value).toBe('');
    });
  });
});
