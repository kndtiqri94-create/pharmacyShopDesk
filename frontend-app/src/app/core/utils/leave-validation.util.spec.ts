import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import {
  LEAVE_ENTITLEMENT_SEED,
  LEAVE_REQUEST_SEED,
  LEAVE_TYPE_SEED,
} from '../services/data/in-memory/seed/leave.seed';
import { USER_SEED } from '../services/data/in-memory/seed/user.seed';
import {
  LEAVE_COMMENTS_MAX,
  LeaveFormInput,
  LeaveValidationContext,
  isEligibleApprover,
  isLeaveTypeSelectable,
  validateLeave,
} from './leave-validation.util';

describe('leave-validation.util', () => {
  const context: LeaveValidationContext = {
    employees: EMPLOYEE_SEED,
    users: USER_SEED,
    types: LEAVE_TYPE_SEED,
    entitlements: LEAVE_ENTITLEMENT_SEED,
    requests: LEAVE_REQUEST_SEED,
  };

  const valid: LeaveFormInput = {
    employeeId: 'emp-005',
    year: 2026,
    leaveTypeId: 'lt-003',
    fromDate: '2026-11-02',
    toDate: '2026-11-03',
    reason: 'Personal',
    comments: '  Family visit ',
    attachment: null,
    coveringEmployeeId: '',
    approverEmployeeId: 'emp-002',
  };

  const run = (changes: Partial<LeaveFormInput>, ctx = context) =>
    validateLeave({ ...valid, ...changes }, ctx);

  it('accepts a good application and returns trimmed, service-ready values', () => {
    const result = run({ coveringEmployeeId: 'emp-006' });
    expect(result.errors).toEqual({});
    expect(result.firstErrorField).toBeNull();
    expect(result.values).toEqual({
      employeeId: 'emp-005',
      leaveTypeId: 'lt-003',
      fromDate: '2026-11-02',
      toDate: '2026-11-03',
      days: 2,
      reason: 'Personal',
      comments: 'Family visit',
      attachmentName: null,
      coveringEmployeeId: 'emp-006',
      approverEmployeeId: 'emp-002',
    });
  });

  it('requires employee, type, dates, reason and approver and reports the first in page order', () => {
    const result = run({
      employeeId: '',
      leaveTypeId: '',
      fromDate: '',
      toDate: '',
      reason: '',
      approverEmployeeId: '',
    });
    expect(result.values).toBeNull();
    expect(result.errors['employeeId']).toBe('Employee is required');
    expect(result.errors['leaveTypeId']).toBe('Leave type is required');
    expect(result.errors['fromDate']).toBe('From date is required');
    expect(result.errors['toDate']).toBe('To date is required');
    expect(result.errors['reason']).toBe('Reason is required');
    expect(result.errors['approverEmployeeId']).toBe('Approver is required');
    expect(result.firstErrorField).toBe('employeeId');
    expect(run({ leaveTypeId: '', reason: '' }).firstErrorField).toBe('leaveTypeId');
    expect(run({ reason: 'Holiday' }).errors['reason']).toBe('Reason is required');
  });

  it('rejects dates that are not real', () => {
    expect(run({ fromDate: '2026-02-31' }).errors['fromDate']).toBe('Enter a real From date');
    expect(run({ toDate: 'abc' }).errors['toDate']).toBe('Enter a real To date');
  });

  it('rejects To before From', () => {
    expect(run({ fromDate: '2026-11-05', toDate: '2026-11-04' }).errors['toDate']).toBe(
      'To date cannot be before From date'
    );
  });

  it('rejects dates outside the chosen leave year', () => {
    expect(run({ fromDate: '2025-12-31', toDate: '2026-01-02' }).errors['fromDate']).toBe(
      'From date must be within 01/01/2026 to 31/12/2026'
    );
    expect(run({ fromDate: '2026-12-31', toDate: '2027-01-01' }).errors['toDate']).toBe(
      'To date must be within 01/01/2026 to 31/12/2026'
    );
    expect(run({ year: Number.NaN }).errors['year']).toBe('Choose a valid leave year');
  });

  it("rejects overlap with the same employee's Pending or Approved leave only", () => {
    const clash = run({ employeeId: 'emp-004', fromDate: '2026-05-05', toDate: '2026-05-06' });
    expect(clash.errors['fromDate']).toBe('Overlaps leave from 4 May 2026 to 5 May 2026');
    const pendingClash = run({
      employeeId: 'emp-003',
      fromDate: '2026-10-14',
      toDate: '2026-10-15',
    });
    expect(pendingClash.errors['fromDate']).toContain('Overlaps leave');
    expect(
      run({ employeeId: 'emp-005', fromDate: '2026-06-16', toDate: '2026-06-16' }).errors
    ).toEqual({});
    expect(
      run({ employeeId: 'emp-006', fromDate: '2026-07-20', toDate: '2026-07-20' }).errors
    ).toEqual({});
    expect(
      run({ employeeId: 'emp-001', fromDate: '2026-05-04', toDate: '2026-05-05' }).errors
    ).toEqual({});
  });

  it('refuses days above the balance with the days left in the message', () => {
    const result = run({ employeeId: 'emp-004', fromDate: '2026-11-02', toDate: '2026-11-07' });
    expect(result.errors['toDate']).toBe('Only 5.00 days of Casual Leave left');
    expect(run({ fromDate: '2026-11-02', toDate: '2026-11-08' }).errors).toEqual({});
    expect(run({ fromDate: '2026-11-02', toDate: '2026-11-09' }).errors['toDate']).toBe(
      'Only 7.00 days of Casual Leave left'
    );
  });

  it('does not allow a leave type with no balance left', () => {
    expect(run({ leaveTypeId: 'lt-002' }).errors['leaveTypeId']).toBe(
      'Carry Forward - Annual Leave has no balance left'
    );
    expect(isLeaveTypeSelectable('emp-005', 'lt-002', 2026, context)).toBeFalse();
    expect(isLeaveTypeSelectable('emp-005', 'lt-003', 2026, context)).toBeTrue();
    expect(run({ leaveTypeId: 'zzz' }).errors['leaveTypeId']).toBe('Choose a listed leave type');
  });

  it('refuses a covering employee who is the applicant, inactive or unknown', () => {
    expect(run({ coveringEmployeeId: 'emp-005' }).errors['coveringEmployeeId']).toBe(
      'Covering employee cannot be the applicant'
    );
    expect(run({ coveringEmployeeId: 'emp-008' }).errors['coveringEmployeeId']).toBe(
      'Choose an active covering employee'
    );
    expect(run({ coveringEmployeeId: 'nobody' }).errors['coveringEmployeeId']).toBeDefined();
  });

  it('allows only an active Admin or Manager other than the applicant as approver', () => {
    expect(run({ approverEmployeeId: 'emp-005' }).errors['approverEmployeeId']).toBe(
      'Approver cannot be the applicant'
    );
    for (const id of ['emp-003', 'emp-004', 'emp-006', 'emp-008', 'nobody']) {
      expect(run({ approverEmployeeId: id }).errors['approverEmployeeId']).toBe(
        'Choose an active Admin or Manager as approver'
      );
    }
    expect(run({ approverEmployeeId: 'emp-001' }).errors).toEqual({});
    const inactiveManager = EMPLOYEE_SEED.map(item =>
      item.id === 'emp-002' ? { ...item, status: EmployeeStatus.INACTIVE } : item
    );
    expect(isEligibleApprover(inactiveManager[1], USER_SEED)).toBeFalse();
    expect(isEligibleApprover(undefined, USER_SEED)).toBeFalse();
  });

  it('requires an active applicant', () => {
    expect(run({ employeeId: 'emp-008' }).errors['employeeId']).toBe('Choose an active employee');
    expect(run({ employeeId: 'nobody' }).errors['employeeId']).toBe('Choose an active employee');
  });

  it('limits comments to 250 characters', () => {
    expect(run({ comments: 'a'.repeat(LEAVE_COMMENTS_MAX) }).errors).toEqual({});
    expect(run({ comments: 'a'.repeat(LEAVE_COMMENTS_MAX + 1) }).errors['comments']).toBe(
      'Comments must be 250 characters or fewer'
    );
  });

  it('checks the attachment type and size and keeps only its name', () => {
    const good = run({ attachment: { name: 'note.pdf', type: 'application/pdf', size: 100 } });
    expect(good.values?.attachmentName).toBe('note.pdf');
    const bad = run({
      attachment: { name: 'run.exe', type: 'application/x-msdownload', size: 100 },
    });
    expect(bad.errors['attachment']).toBe('Choose a PDF, JPG or PNG file of 2 MB or less');
  });

  it('puts problems in page order when several fields are wrong', () => {
    const result = run({ comments: 'a'.repeat(300), approverEmployeeId: '', toDate: 'x' });
    expect(result.firstErrorField).toBe('toDate');
    expect(run({ comments: 'a'.repeat(300), approverEmployeeId: '' }).firstErrorField).toBe(
      'comments'
    );
  });

  it('counts a Pending request against the balance', () => {
    const requests = [
      ...LEAVE_REQUEST_SEED,
      {
        ...LEAVE_REQUEST_SEED[1],
        id: 'p',
        employeeId: 'emp-005',
        leaveTypeId: 'lt-003',
        fromDate: '2026-12-01',
        toDate: '2026-12-05',
        days: 5,
        status: LeaveStatus.PENDING,
      },
    ];
    const result = run({ fromDate: '2026-11-02', toDate: '2026-11-04' }, { ...context, requests });
    expect(result.errors['toDate']).toBe('Only 2.00 days of Casual Leave left');
  });
});
