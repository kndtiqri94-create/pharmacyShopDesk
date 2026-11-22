import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { RoleDataService } from '../../../../core/services/data/role-data.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { PosService } from '../../../../core/services/pos.service';
import { PosActionsComponent } from './pos-actions.component';

describe('PosActionsComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => clearBrowserStorage());

  async function render(viewOnly = false) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.CASHIER);
    if (viewOnly) {
      await TestBed.inject(PermissionService).load();
      const roleDataService = TestBed.inject(RoleDataService);
      const matrix = await firstValueFrom(roleDataService.getMatrix());
      await firstValueFrom(
        roleDataService.saveMatrix({ ...matrix, CASHIER: { ...matrix.CASHIER, pos: 'VIEW' } })
      );
    }
    const pos = TestBed.inject(PosService);
    await pos.open();
    const fixture = TestBed.createComponent(PosActionsComponent);
    const raised: string[] = [];
    const component = fixture.componentInstance;
    component.saveAndPrintRequested.subscribe(() => raised.push('save-print'));
    component.saveRequested.subscribe(() => raised.push('save'));
    component.holdRequested.subscribe(() => raised.push('hold'));
    component.newBillRequested.subscribe(() => raised.push('new'));
    component.heldBillsRequested.subscribe(() => raised.push('held'));
    component.saveQuotationRequested.subscribe(() => raised.push('quote'));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = () => Array.from(element.querySelectorAll('button'));
    const button = (label: string) =>
      label === 'Save'
        ? buttons()[1]
        : buttons().find(candidate => candidate.textContent?.includes(label))!;
    return { fixture, element, button, raised, pos };
  }

  it('shows Save & Print, Save, Hold and New each with its shortcut key', async () => {
    const { button } = await render();
    expect(button('Save & Print').textContent).toContain('F1');
    expect(button('Save').textContent).toContain('F2');
    expect(button('Hold').textContent).toContain('F10');
    expect(button('New').textContent).toContain('F12');
  });

  it('raises the matching request for each button', async () => {
    const { button, raised } = await render();
    button('Save & Print').click();
    button('Hold').click();
    button('New').click();
    button('Held bills').click();
    button('Save Quotation').click();
    expect(raised).toEqual(['save-print', 'hold', 'new', 'held', 'quote']);
  });

  it('shows how many bills are on hold', async () => {
    const { fixture, button, pos } = await render();
    expect(button('Held bills').textContent).toContain('(0)');
    pos.addProduct('prod-001');
    await pos.holdBill();
    fixture.detectChanges();
    expect(button('Held bills').textContent).toContain('(1)');
  });

  it('has a Save Quotation button showing F11 and none of the bottom bar buttons', async () => {
    const { element, button } = await render();
    const text = element.textContent ?? '';
    for (const phaseB of [
      'Last Invoice',
      'Cash Book',
      'Update Products',
      'Add OB',
      'Counter Close',
      'Bill & Reload',
      'Drawer',
      'Due Amount',
      'Return',
    ]) {
      expect(text).withContext(phaseB).not.toContain(phaseB);
    }
    expect(element.querySelectorAll('button')).toHaveSize(6);
    expect(button('Save Quotation').textContent).toContain('F11');
  });

  it('uses extra large buttons so each is at least 52px', async () => {
    const { element } = await render();
    for (const candidate of Array.from(element.querySelectorAll('button'))) {
      expect(candidate.getAttribute('data-size')).toBe('xl');
      expect(parseFloat(getComputedStyle(candidate).minHeight)).toBeGreaterThanOrEqual(52);
    }
  });

  it('turns Save, Save & Print and Hold off for a user who cannot sell', async () => {
    const { button } = await render(true);
    expect(button('Save & Print').disabled).toBeTrue();
    expect(button('Hold').disabled).toBeTrue();
    expect(button('Held bills').disabled).toBeFalse();
  });
});

describe('PosActionsComponent layout and tints', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => clearBrowserStorage());

  async function renderActions() {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.CASHIER);
    await TestBed.inject(PosService).open();
    const fixture = TestBed.createComponent(PosActionsComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll('button'));
    const byLabel = (label: string) =>
      buttons.find(candidate => candidate.textContent?.includes(label))!;
    return { element, buttons, byLabel };
  }

  it('colour-codes each button, keeping its label and icon', async () => {
    const { buttons, byLabel } = await renderActions();
    expect(byLabel('Save & Print').getAttribute('data-tone')).toBe('green');
    expect(buttons[1].getAttribute('data-tone')).toBe('purple');
    expect(byLabel('Hold').getAttribute('data-tone')).toBe('amber');
    expect(byLabel('Save Quotation').getAttribute('data-tone')).toBe('muted');
    expect(byLabel('New').getAttribute('data-tone')).toBe('slate');
    for (const candidate of buttons) {
      expect(candidate.querySelector('app-icon')).not.toBeNull();
      expect(candidate.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('puts Save & Print full width above a two by two grid in the order Save, Hold, Save Quotation, New', async () => {
    const { element, byLabel } = await renderActions();
    const wide = element.querySelector('.actions__item--wide') as HTMLElement;
    expect(wide.contains(byLabel('Save & Print'))).toBeTrue();
    const grid = element.querySelector('.actions__grid') as HTMLElement;
    const order = Array.from(grid.querySelectorAll('button')).map(candidate =>
      candidate.textContent?.replace(/\s*F\d+$/, '').trim()
    );
    expect(order).toEqual(['Save', 'Hold', 'Save Quotation', 'New']);
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ')).toHaveSize(2);
    expect(wide.getBoundingClientRect().width).toBeGreaterThan(
      (grid.firstElementChild as HTMLElement).getBoundingClientRect().width
    );
  });

  it('shows each shortcut hint at the bottom right of its button', async () => {
    const { element } = await renderActions();
    const hints = Array.from(element.querySelectorAll<HTMLElement>('.actions__key'));
    expect(hints.map(hint => hint.textContent)).toEqual(['F1', 'F2', 'F10', 'F11', 'F12']);
    for (const hint of hints) {
      expect(getComputedStyle(hint).position).toBe('absolute');
      expect(getComputedStyle(hint).right).not.toBe('auto');
      expect(getComputedStyle(hint).bottom).not.toBe('auto');
    }
  });
});
