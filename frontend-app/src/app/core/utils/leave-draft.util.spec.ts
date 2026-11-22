import { draftAfterApply, emptyLeaveDraft, isLeaveDraftDirty } from './leave-draft.util';

describe('leave-draft.util', () => {
  it('starts empty with the given year', () => {
    const draft = emptyLeaveDraft(2026);
    expect(draft.employeeId).toBe('');
    expect(draft.year).toBe(2026);
    expect(draft.attachment).toBeNull();
  });

  it('is not dirty when equal to the baseline', () => {
    expect(isLeaveDraftDirty(emptyLeaveDraft(2026), emptyLeaveDraft(2026))).toBeFalse();
  });

  it('is dirty for each changed field', () => {
    const base = emptyLeaveDraft(2026);
    const changes = [
      { employeeId: 'emp-1' },
      { year: 2027 },
      { leaveTypeId: 'lt-001' },
      { fromDate: '2026-01-01' },
      { toDate: '2026-01-02' },
      { reason: 'Personal' },
      { comments: 'x' },
      { coveringEmployeeId: 'emp-2' },
      { approverEmployeeId: 'emp-3' },
      { attachment: { name: 'a.pdf', type: 'application/pdf', size: 10 } },
    ];
    for (const change of changes) {
      expect(isLeaveDraftDirty({ ...base, ...change }, base))
        .withContext(JSON.stringify(change))
        .toBeTrue();
    }
  });

  it('keeps only the employee and year after apply', () => {
    const next = draftAfterApply({
      ...emptyLeaveDraft(2026, 'emp-1'),
      leaveTypeId: 'lt-001',
      reason: 'Medical',
      comments: 'private',
      attachment: { name: 'a.pdf', type: 'application/pdf', size: 10 },
    });
    expect(next).toEqual(emptyLeaveDraft(2026, 'emp-1'));
  });
});
