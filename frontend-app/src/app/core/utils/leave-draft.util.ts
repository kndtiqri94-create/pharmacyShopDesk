import { LeaveFormInput } from './leave-validation.util';

export function emptyLeaveDraft(year: number, employeeId = ''): LeaveFormInput {
  return {
    employeeId,
    year,
    leaveTypeId: '',
    fromDate: '',
    toDate: '',
    reason: '',
    comments: '',
    attachment: null,
    coveringEmployeeId: '',
    approverEmployeeId: '',
  };
}

export function draftAfterApply(draft: LeaveFormInput): LeaveFormInput {
  return emptyLeaveDraft(draft.year, draft.employeeId);
}

export function isLeaveDraftDirty(draft: LeaveFormInput, baseline: LeaveFormInput): boolean {
  return (
    draft.employeeId !== baseline.employeeId ||
    draft.year !== baseline.year ||
    draft.leaveTypeId !== baseline.leaveTypeId ||
    draft.fromDate !== baseline.fromDate ||
    draft.toDate !== baseline.toDate ||
    draft.reason !== baseline.reason ||
    draft.comments !== baseline.comments ||
    draft.coveringEmployeeId !== baseline.coveringEmployeeId ||
    draft.approverEmployeeId !== baseline.approverEmployeeId ||
    (draft.attachment?.name ?? null) !== (baseline.attachment?.name ?? null)
  );
}
