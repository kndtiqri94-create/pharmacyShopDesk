import { TestBed } from '@angular/core/testing';
import { UserStatus } from '../../../../core/models/enums/user-status.enum';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import { USER_SEED } from '../../../../core/services/data/in-memory/seed/user.seed';
import { buildUserRows } from '../../../../core/utils/user-list.util';
import { UsersCardComponent } from './users-card.component';

describe('UsersCardComponent', () => {
  function render(canEdit = true) {
    const users = USER_SEED.map(user =>
      user.id === 'usr-003' ? { ...user, status: UserStatus.DISABLED } : user
    );
    const fixture = TestBed.createComponent(UsersCardComponent);
    fixture.componentRef.setInput('rows', buildUserRows(users, EMPLOYEE_SEED));
    fixture.componentRef.setInput('currentUserId', 'usr-001');
    fixture.componentRef.setInput('canEdit', canEdit);
    const events: string[] = [];
    fixture.componentInstance.editUser.subscribe(row => events.push(`edit ${row.user.id}`));
    fixture.componentInstance.toggleLock.subscribe(row => events.push(`lock ${row.user.id}`));
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, events };
  }

  it('names the actions for each person, and says Enable for a disabled user', () => {
    const { element } = render();
    const labels = Array.from(element.querySelectorAll('tbody button')).map(button =>
      button.getAttribute('aria-label')
    );
    expect(labels).toContain('Edit Dilani Fernando');
    expect(labels).toContain('Enable Dilani Fernando');
    expect(labels).toContain('Disable Kamal Silva');
  });

  it('raises edit and lock for another person, and the lock is unavailable on your own row', () => {
    const { element, events } = render();
    (element.querySelector('button[aria-label="Edit Kamal Silva"]') as HTMLElement).click();
    (element.querySelector('button[aria-label="Disable Kamal Silva"]') as HTMLElement).click();
    const own = element.querySelector(
      'button[aria-label^="Disable Nimal Perera"]'
    ) as HTMLButtonElement;
    expect(own.disabled).toBeTrue();
    own.click();
    expect(events).toEqual(['edit usr-002', 'lock usr-002']);
  });

  it('shows the status as a word and the count of active users', () => {
    const { element } = render();
    expect(element.textContent).toContain('3 active users');
    expect(element.textContent).toContain('Disabled');
  });

  it('shows no actions when the person cannot change users', () => {
    const { element } = render(false);
    expect(element.querySelector('tbody button')).toBeNull();
  });
});
