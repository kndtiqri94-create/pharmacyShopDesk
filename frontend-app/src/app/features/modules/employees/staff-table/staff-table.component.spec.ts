import { TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS } from '../../../../../testing/auth-test.util';
import { UserStatus } from '../../../../core/models/enums/user-status.enum';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import { USER_SEED } from '../../../../core/services/data/in-memory/seed/user.seed';
import { toEmployeeListItems } from '../../../../core/utils/employee-list-filter.util';
import { StaffTableComponent } from './staff-table.component';

describe('StaffTableComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: TEST_PROVIDERS }));

  function render(users = USER_SEED) {
    const fixture = TestBed.createComponent(StaffTableComponent);
    fixture.componentRef.setInput('items', toEmployeeListItems(EMPLOYEE_SEED, users));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the role of a disabled user with a Disabled marker and a neutral tone', () => {
    const disabled = USER_SEED.map(user =>
      user.id === 'usr-002' ? { ...user, status: UserStatus.DISABLED } : user
    );
    const { element } = render(disabled);
    const cell = element.querySelectorAll('tbody tr')[1].querySelector('td:nth-child(5)')!;
    expect(cell.textContent?.trim()).toBe('Manager · Disabled');
    expect(cell.querySelector('.badge')?.getAttribute('data-tone')).toBe('neutral');
  });

  it('asks the page for a sample-only message when a row action is pressed', () => {
    const { fixture, element } = render();
    const chosen: string[] = [];
    fixture.componentInstance.actionChosen.subscribe(feature => chosen.push(feature));
    (element.querySelector('button[aria-label="View Nimal Perera"]') as HTMLElement).click();
    expect(chosen).toEqual(['View employee']);
  });
});
