import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { closeOpenDialogs, settle } from '../../../../../testing/pos-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { BankAccountService } from '../../../../core/services/bank-account.service';
import { SRI_LANKAN_BANKS } from '../../../../core/utils/sri-lankan-banks.const';
import { CreateAccountDialogComponent } from './create-account-dialog.component';

describe('CreateAccountDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    clearBrowserStorage();
  });

  async function render() {
    await signInAs(UserRole.CASHIER);
    const service = TestBed.inject(BankAccountService);
    await service.load();
    const fixture = TestBed.createComponent(CreateAccountDialogComponent);
    const closed: string[] = [];
    const created: string[] = [];
    fixture.componentInstance.closed.subscribe(() => closed.push('closed'));
    fixture.componentInstance.created.subscribe(id => created.push(id));
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const control = (id: string) => element.querySelector(`#${id}`) as HTMLInputElement;
    const set = (id: string, value: string) => {
      const target = control(id);
      target.value = value;
      target.dispatchEvent(new Event(target.tagName === 'SELECT' ? 'change' : 'input'));
      fixture.detectChanges();
    };
    const fillValid = () => {
      set('create-account-bank', 'HSBC');
      set('create-account-branch', 'Kandy');
      set('create-account-holder', 'ShopDesk Pharmacy');
      set('create-account-number', '555666777');
      set('create-account-balance', '0');
    };
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === label
      )!;
    const save = async () => {
      button('Save').click();
      await settle(fixture);
    };
    const error = (id: string) => element.querySelector(`#${id}-error`)?.textContent?.trim();
    return {
      fixture,
      element,
      service,
      closed,
      created,
      control,
      set,
      fillValid,
      button,
      save,
      error,
    };
  }

  it('opens as a modal titled Create Account with focus inside it', async () => {
    const { element, fixture } = await render();
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();
    expect(element.querySelector('h2')?.textContent).toContain('Create Account');
    await new Promise<void>(resolve => setTimeout(resolve));
    fixture.detectChanges();
    expect(dialog.contains(document.activeElement)).toBeTrue();
  });

  it('marks the five fields required with a red asterisk and colours Save green and Cancel slate', async () => {
    const { element, button } = await render();
    expect(element.querySelectorAll('.field__required')).toHaveSize(5);
    expect(button('Save').getAttribute('data-tone')).toBe('green');
    expect(button('Cancel').getAttribute('data-tone')).toBe('slate');
  });

  it('offers only the fixed list of banks, in order', async () => {
    const { element } = await render();
    const options = Array.from(
      element.querySelectorAll<HTMLOptionElement>('#create-account-bank option')
    )
      .slice(1)
      .map(option => option.value);
    expect(options).toEqual([...SRI_LANKAN_BANKS]);
    expect(element.querySelector('input[list]')).toBeNull();
  });

  it('shows a message beside each invalid field and adds nothing', async () => {
    const { service, save, error, closed } = await render();
    await save();
    for (const id of [
      'create-account-bank',
      'create-account-branch',
      'create-account-holder',
      'create-account-number',
      'create-account-balance',
    ]) {
      expect(error(id)).withContext(id).toBeDefined();
    }
    expect(service.accounts()).toHaveSize(3);
    expect(closed).toHaveSize(0);
  });

  it('accepts only digits and no more than 20 in Account No', async () => {
    const { set, control } = await render();
    expect(control('create-account-number').getAttribute('maxlength')).toBe('20');
    set('create-account-number', '12ab34-56');
    expect(control('create-account-number').value).toBe('123456');
  });

  it('flags a negative or 3 decimal Opening Balance and a short Branch', async () => {
    const { fillValid, set, save, error } = await render();
    fillValid();
    set('create-account-balance', '-5');
    set('create-account-branch', 'a');
    await save();
    expect(error('create-account-balance')).toBeDefined();
    expect(error('create-account-branch')).toBeDefined();
    set('create-account-balance', '1.234');
    await save();
    expect(error('create-account-balance')).toBeDefined();
  });

  it('rejects a duplicate and stays open', async () => {
    const { fillValid, set, save, error, closed, service } = await render();
    fillValid();
    set('create-account-bank', 'Sampath Bank');
    set('create-account-number', '1002345678');
    await save();
    expect(error('create-account-number')).toContain('already exists');
    expect(closed).toHaveSize(0);
    expect(service.accounts()).toHaveSize(3);
  });

  it('adds the account, closes and reports the new account on a valid Save', async () => {
    const { fillValid, save, closed, created, service } = await render();
    fillValid();
    await save();
    expect(service.accounts()).toHaveSize(4);
    expect(created).toEqual(['bank-004']);
    expect(closed).toHaveSize(1);
  });

  it('closes without adding anything from Cancel and from the X icon', async () => {
    const { element, button, closed, service, fillValid } = await render();
    fillValid();
    button('Cancel').click();
    (element.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
    expect(closed).toHaveSize(2);
    expect(service.accounts()).toHaveSize(3);
  });

  it('closes on Esc without adding anything', async () => {
    const { element, closed, service } = await render();
    (element.querySelector('dialog') as HTMLDialogElement).dispatchEvent(
      new Event('cancel', { cancelable: true })
    );
    expect(closed).toHaveSize(1);
    expect(service.accounts()).toHaveSize(3);
  });

  it('starts empty each time it opens', async () => {
    const { fixture, fillValid, control } = await render();
    fillValid();
    fixture.componentRef.setInput('open', false);
    await settle(fixture);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    expect(control('create-account-branch').value).toBe('');
    expect(control('create-account-bank').value).toBe('');
  });

  it('makes every control at least 52px tall', async () => {
    const { element } = await render();
    const boxes = Array.from(element.querySelectorAll<HTMLElement>('.sd-field-box'));
    expect(boxes).toHaveSize(5);
    for (const box of boxes) {
      expect(parseFloat(getComputedStyle(box).minHeight)).toBeGreaterThanOrEqual(52);
    }
    for (const candidate of Array.from(element.querySelectorAll('button'))) {
      expect(parseFloat(getComputedStyle(candidate).minHeight)).toBeGreaterThanOrEqual(52);
    }
  });
});
