import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import {
  emptyEmployeeDraft,
  fromDraft,
  isDraftDirty,
  isEmployeeDirty,
  toDraft,
} from './employee-diff.util';
import { validateEmployee } from './employee-validation.util';

const SAVED = EMPLOYEE_SEED[1];
const CONTEXT = { employees: EMPLOYEE_SEED, editingId: SAVED.id, today: '2026-10-18' };

describe('employee diff', () => {
  it('turns cents into rupee text for the draft', () => {
    const draft = toDraft(EMPLOYEE_SEED[0]);
    expect(draft.basicSalary).toBe((EMPLOYEE_SEED[0].basicSalaryCents / 100).toFixed(2));
    expect(draft.allowances[0].amount).toBe('50000.00');
    expect(draft.mobile).toBe(EMPLOYEE_SEED[0].phone);
  });

  it('starts a new draft with the defaults', () => {
    const draft = emptyEmployeeDraft('Main Pharmacy');
    expect(draft.status).toBe('ACTIVE');
    expect(draft.location).toBe('Main Pharmacy');
    expect(draft.basicSalary).toBe('0');
    expect(draft.calculateEpf).toBeFalse();
    expect(draft.createUserAccount).toBeFalse();
    expect(draft.allowances).toEqual([]);
  });

  it('is clean until something changes and clean again when changed back', () => {
    const draft = toDraft(SAVED);
    expect(isEmployeeDirty(draft, SAVED)).toBeFalse();
    expect(isEmployeeDirty({ ...draft, firstName: `${draft.firstName}x` }, SAVED)).toBeTrue();
    expect(isEmployeeDirty({ ...draft, calculateEpf: !draft.calculateEpf }, SAVED)).toBeTrue();
    expect(
      isEmployeeDirty({ ...draft, photoDataUrl: 'data:image/png;base64,AA' }, SAVED)
    ).toBeTrue();
    expect(isEmployeeDirty({ ...draft, firstName: draft.firstName }, SAVED)).toBeFalse();
  });

  it('notices allowance changes', () => {
    const draft = toDraft(EMPLOYEE_SEED[0]);
    const saved = EMPLOYEE_SEED[0];
    expect(isEmployeeDirty({ ...draft, allowances: [] }, saved)).toBeTrue();
    expect(
      isEmployeeDirty({ ...draft, allowances: [{ ...draft.allowances[0], amount: '1.00' }] }, saved)
    ).toBeTrue();
    expect(
      isEmployeeDirty(
        { ...draft, allowances: [...draft.allowances, { id: 'n', name: '', amount: '' }] },
        saved
      )
    ).toBeTrue();
    expect(
      isEmployeeDirty({ ...draft, allowances: [{ ...draft.allowances[0] }] }, saved)
    ).toBeFalse();
  });

  it('compares a new draft with its baseline', () => {
    const baseline = emptyEmployeeDraft('Main Pharmacy');
    expect(isDraftDirty({ ...baseline }, baseline)).toBeFalse();
    expect(isDraftDirty({ ...baseline, code: 'A' }, baseline)).toBeTrue();
  });

  it('round trips through validation and back to the same draft values', () => {
    const draft = { ...toDraft(SAVED), firstName: 'Kamala', commissionRate: '2.5' };
    const values = validateEmployee(draft, CONTEXT).values!;
    const saved = fromDraft(values, SAVED);
    expect(saved.name).toBe(
      `Kamala ${[SAVED.middleName, SAVED.lastName].filter(Boolean).join(' ')}`
    );
    expect(saved.id).toBe(SAVED.id);
    expect(saved.userId).toBe(SAVED.userId);
    expect(saved.createdAt).toBe(SAVED.createdAt);
    expect(saved.commissionRate).toBe(2.5);
    expect(saved.phone).toBe(values.mobile);
    expect(saved.jobTitle).toBe(SAVED.jobTitle);
  });

  it('does not change the employee it is given and does not share allowance objects', () => {
    const before = structuredClone(EMPLOYEE_SEED[0]);
    const values = validateEmployee(toDraft(EMPLOYEE_SEED[0]), {
      ...CONTEXT,
      editingId: EMPLOYEE_SEED[0].id,
    }).values!;
    const saved = fromDraft(values, EMPLOYEE_SEED[0]);
    saved.allowances[0].name = 'Changed';
    expect(EMPLOYEE_SEED[0]).toEqual(before);
  });
});
