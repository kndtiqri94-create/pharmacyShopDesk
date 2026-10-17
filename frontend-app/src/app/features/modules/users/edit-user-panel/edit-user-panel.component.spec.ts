import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { AppUser } from '../../../../core/models/domain/app-user.model';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { UserDataService } from '../../../../core/services/data/user-data.service';
import { USER_SEED } from '../../../../core/services/data/in-memory/seed/user.seed';
import { UserRow } from '../../../../core/utils/user-list.util';
import { EditUserPanelComponent } from './edit-user-panel.component';

describe('EditUserPanelComponent', () => {
  beforeEach(() => clearBrowserStorage());
  afterEach(() => clearBrowserStorage());

  async function render(userId: string) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.ADMIN);
    const user = USER_SEED.find(candidate => candidate.id === userId)!;
    const row: UserRow = { user, employeeCode: 'EMP-000' };
    const fixture = TestBed.createComponent(EditUserPanelComponent);
    fixture.componentRef.setInput('row', row);
    fixture.componentRef.setInput('currentUserId', 'usr-001');
    fixture.componentRef.setInput('open', true);
    const saved: AppUser[] = [];
    fixture.componentInstance.saved.subscribe(item => saved.push(item));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector('#edit-user-role') as HTMLSelectElement;
    const save = () =>
      (
        Array.from(element.querySelectorAll('button')).find(
          candidate => candidate.textContent?.trim() === 'Save changes'
        ) as HTMLButtonElement
      ).click();
    return { fixture, element, select, save, saved };
  }

  it('shows the current role and the read-only details', async () => {
    const { element, select } = await render('usr-003');
    expect(select.value).toBe('PHARMACIST');
    expect(element.textContent).toContain('Dilani Fernando');
    expect(element.textContent).toContain('dilani · EMP-000');
  });

  it('saves a new role and leaves the username and employee link as they are', async () => {
    const { fixture, select, save, saved } = await render('usr-003');
    select.value = 'MANAGER';
    select.dispatchEvent(new Event('change'));
    save();
    await new Promise(resolve => setTimeout(resolve, 20));
    fixture.detectChanges();
    expect(saved).toHaveSize(1);
    const stored = await firstValueFrom(TestBed.inject(UserDataService).getById('usr-003'));
    expect(stored?.role).toBe('MANAGER');
    expect(stored?.username).toBe('dilani');
    expect(stored?.employeeId).toBe('emp-003');
  });

  it('locks the role of your own account and cannot save it', async () => {
    const { element, select, save, saved } = await render('usr-001');
    expect(select.disabled).toBeTrue();
    save();
    expect(saved).toEqual([]);
    expect(element.textContent).toContain('You cannot change your own role.');
  });
});
