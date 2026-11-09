import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { setPosLevel, settle } from '../../../../../testing/pos-test.util';
import { PermissionLevel } from '../../../../core/models/enums/permission-level.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { PermissionService } from '../../../../core/services/permission.service';
import {
  BOTTOM_BAR_ITEMS,
  BottomBarAction,
  PosBottomBarComponent,
} from './pos-bottom-bar.component';

describe('PosBottomBarComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  async function render(role: UserRole = UserRole.CASHIER) {
    await signInAs(role);
    await TestBed.inject(PermissionService).load();
    const fixture = TestBed.createComponent(PosBottomBarComponent);
    const raised: BottomBarAction[] = [];
    fixture.componentInstance.actionRequested.subscribe(action => raised.push(action));
    await settle(fixture, 0);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, raised };
  }

  it('shows the nine Phase B buttons in order, and no Transfer or Normal button', async () => {
    const { element } = await render();
    const labels = Array.from(element.querySelectorAll('button')).map(button =>
      button.textContent?.trim()
    );
    expect(labels).toEqual(BOTTOM_BAR_ITEMS.map(item => item.label));
    expect(labels).toHaveSize(9);
    expect(element.textContent).not.toContain('Transfer');
    expect(element.textContent).not.toContain('Normal');
  });

  it('raises the matching action for each button', async () => {
    const { element, raised } = await render();
    for (const button of Array.from(element.querySelectorAll('button'))) button.click();
    expect(raised).toEqual(BOTTOM_BAR_ITEMS.map(item => item.action));
  });

  it('makes every button at least 52px', async () => {
    const { element } = await render();
    for (const button of Array.from(element.querySelectorAll('button'))) {
      expect(parseFloat(getComputedStyle(button).minHeight)).toBeGreaterThanOrEqual(52);
    }
  });

  it('is still shown for a user who can only view the till', async () => {
    await signInAs(UserRole.CASHIER);
    await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
    const fixture = TestBed.createComponent(PosBottomBarComponent);
    await settle(fixture, 0);
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveSize(9);
  });

  it('shows nothing to a user without POS access', async () => {
    await signInAs(UserRole.CASHIER);
    await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
    const fixture = TestBed.createComponent(PosBottomBarComponent);
    await settle(fixture, 0);
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveSize(0);
  });

  it('shows nothing when nobody is signed in', async () => {
    const fixture = TestBed.createComponent(PosBottomBarComponent);
    await settle(fixture, 0);
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveSize(0);
  });
});
