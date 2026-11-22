import { TestBed } from '@angular/core/testing';
import { LeaveDecision } from '../../../../../core/services/leave-admin.service';
import { LeaveListRow } from '../../../../../core/utils/leave-list.util';
import { LEAVE_REQUEST_SEED } from '../../../../../core/services/data/in-memory/seed/leave.seed';
import { LeaveDecisionDialogComponent } from './leave-decision-dialog.component';

const ROW: LeaveListRow = {
  request: LEAVE_REQUEST_SEED[1],
  employeeName: 'Dilani Fernando',
  employeeCode: 'EMP-003',
  leaveTypeName: 'Annual Leave',
  approverName: 'Kamal Silva',
  coveringName: '–',
};

describe('LeaveDecisionDialogComponent', () => {
  function render(decision: LeaveDecision) {
    const fixture = TestBed.createComponent(LeaveDecisionDialogComponent);
    fixture.componentRef.setInput('row', ROW);
    fixture.componentRef.setInput('decision', decision);
    const confirmed: string[] = [];
    let cancelled = 0;
    fixture.componentInstance.confirmed.subscribe(value => confirmed.push(value));
    fixture.componentInstance.cancelled.subscribe(() => (cancelled += 1));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find(
        item => item.textContent?.trim() === text
      ) as HTMLButtonElement;
    return { fixture, element, confirmed, cancelled: () => cancelled, button };
  }

  it('names the employee and the approve outcome and confirms with an empty comment', () => {
    const { element, confirmed, button } = render('APPROVE');
    expect(element.textContent).toContain('Approve leave for Dilani Fernando?');
    expect(element.textContent).toContain('3.00 days');
    expect(button('Approve').getAttribute('data-variant')).toBe('primary');
    button('Approve').click();
    expect(confirmed).toEqual(['']);
  });

  it('shows Reject as a danger action and sends the trimmed comment', () => {
    const { fixture, element, confirmed, button } = render('REJECT');
    expect(element.textContent).toContain('Reject leave for Dilani Fernando?');
    expect(button('Reject').getAttribute('data-variant')).toBe('danger');
    const box = element.querySelector('textarea') as HTMLTextAreaElement;
    box.value = '  Not this week ';
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Reject').click();
    expect(confirmed).toEqual(['Not this week']);
  });

  it('caps the comment at 250 characters and reports a cancel', () => {
    const { fixture, element, cancelled, button } = render('APPROVE');
    const box = element.querySelector('textarea') as HTMLTextAreaElement;
    box.value = 'x'.repeat(300);
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.textContent).toContain('250 of 250 characters');
    button('Cancel').click();
    expect(cancelled()).toBe(1);
  });
});
