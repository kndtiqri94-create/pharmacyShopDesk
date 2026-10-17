import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { ROLE_PERMISSION_SEED } from '../../../../core/services/data/in-memory/seed/role-permission.seed';
import { RolePermissionsCardComponent } from './role-permissions-card.component';

describe('RolePermissionsCardComponent', () => {
  beforeEach(() => clearBrowserStorage());
  afterEach(() => clearBrowserStorage());

  async function render(role: UserRole) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(RolePermissionsCardComponent);
    fixture.componentRef.setInput('matrix', ROLE_PERMISSION_SEED);
    let edits = 0;
    fixture.componentInstance.editRoles.subscribe(() => (edits += 1));
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, edits: () => edits };
  }

  it('shows words, never colour alone, for every module and role', async () => {
    const { element } = await render(UserRole.ADMIN);
    const badges = Array.from(element.querySelectorAll('tbody app-badge'));
    expect(badges).toHaveSize(36);
    expect(
      badges.every(badge => ['Full', 'View', 'No access'].includes(badge.textContent!.trim()))
    ).toBeTrue();
  });

  it('raises Edit roles for an Admin', async () => {
    const { element, edits } = await render(UserRole.ADMIN);
    (element.querySelector('button') as HTMLElement).click();
    expect(edits()).toBe(1);
  });

  it('hides Edit roles from anyone who cannot change users', async () => {
    const { element } = await render(UserRole.MANAGER);
    expect(element.querySelector('button')).toBeNull();
  });
});
