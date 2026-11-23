const GENERIC_REASON = 'The central record could not accept this change.';

const REASON_TEXT: Readonly<Record<string, string>> = {
  validation_error: 'Some details on this change were not valid.',
  duplicate_sku: 'Another product already uses this product code.',
  duplicate_bank_account: 'This bank account already exists.',
  duplicate_username: 'Another user already has this username.',
  duplicate_employee_code: 'Another employee already has this code.',
  duplicate_invoice_no: 'Another sale already has this invoice number.',
  duplicate_number: 'Another record already has this number.',
  duplicate_leave_type: 'This leave type already exists.',
  duplicate_entitlement: 'This leave entitlement already exists.',
  duplicate_attendance: 'Attendance for this employee and day already exists.',
  duplicate_payroll_input: 'Payroll details for this employee and month already exist.',
  duplicate_payroll_payment: 'A payment for this employee and month already exists.',
  immutable_record: 'This record was already completed and cannot be changed.',
  unknown_entity: 'This kind of record is not accepted by the central record.',
  invalid_change: 'This change was incomplete.',
  id_mismatch: 'This change did not match its record.',
  unknown_document: 'This setting is not known to the central record.',
  document_cannot_be_deleted: 'Settings cannot be removed.',
  movement_cannot_be_deleted: 'Stock movements cannot be removed.',
};

export function reasonText(code: string | undefined): string {
  if (code === undefined) return GENERIC_REASON;
  return REASON_TEXT[code] ?? GENERIC_REASON;
}
