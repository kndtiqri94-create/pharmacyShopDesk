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
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = () => Array.from(element.querySelectorAll('button'));
    const button = (label: string) =>
      label === 'Save'
        ? buttons()[1]
        : buttons().find(candidate => candidate.textContent?.includes(label))!;
    return { fixture, element, button, raised, pos };
  }

  it('shows Save & print, Save, Hold and New each with its shortcut key', async () => {
    const { button } = await render();
    expect(button('Save & print').textContent).toContain('F1');
    expect(button('Save').textContent).toContain('F2');
    expect(button('Hold').textContent).toContain('F10');
    expect(button('New').textContent).toContain('F12');
  });

  it('raises the matching request for each button', async () => {
    const { button, raised } = await render();
    button('Save & print').click();
    button('Hold').click();
    button('New').click();
    button('Held bills').click();
    expect(raised).toEqual(['save-print', 'hold', 'new', 'held']);
  });

  it('shows how many bills are on hold', async () => {
    const { fixture, button, pos } = await render();
    expect(button('Held bills').textContent).toContain('(0)');
    pos.addProduct('prod-001');
    await pos.holdBill();
    fixture.detectChanges();
    expect(button('Held bills').textContent).toContain('(1)');
  });

  it('has one primary button and no Phase B buttons, not even disabled ones', async () => {
    const { element } = await render();
    const primaries = element.querySelectorAll('button[data-variant="primary"]');
    expect(primaries).toHaveSize(1);
    const text = element.textContent ?? '';
    for (const phaseB of [
      'Last Invoice',
      'Quotation',
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
    expect(element.querySelectorAll('button')).toHaveSize(5);
  });

  it('uses extra large buttons so each is at least 52px', async () => {
    const { element } = await render();
    for (const candidate of Array.from(element.querySelectorAll('button'))) {
      expect(candidate.getAttribute('data-size')).toBe('xl');
      expect(parseFloat(getComputedStyle(candidate).minHeight)).toBeGreaterThanOrEqual(52);
    }
  });

  it('turns Save, Save & print and Hold off for a user who cannot sell', async () => {
    const { button } = await render(true);
    expect(button('Save & print').disabled).toBeTrue();
    expect(button('Hold').disabled).toBeTrue();
    expect(button('Held bills').disabled).toBeFalse();
  });
});
