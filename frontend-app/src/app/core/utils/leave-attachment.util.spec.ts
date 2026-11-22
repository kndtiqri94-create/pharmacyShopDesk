import {
  LEAVE_ATTACHMENT_ERROR,
  LEAVE_ATTACHMENT_MAX_BYTES,
  validateLeaveAttachment,
} from './leave-attachment.util';

describe('leave-attachment.util', () => {
  const file = (name: string, type: string, size = 1000) => ({ name, type, size });

  it('accepts PDF, JPG and PNG up to 2 MB', () => {
    expect(validateLeaveAttachment(file('note.pdf', 'application/pdf'))).toBeNull();
    expect(validateLeaveAttachment(file('a.JPG', 'image/jpeg'))).toBeNull();
    expect(
      validateLeaveAttachment(file('a.png', 'image/png', LEAVE_ATTACHMENT_MAX_BYTES))
    ).toBeNull();
  });

  it('rejects other types, mismatched extensions, empty and oversized files', () => {
    expect(validateLeaveAttachment(file('a.exe', 'application/octet-stream'))).toBe(
      LEAVE_ATTACHMENT_ERROR
    );
    expect(validateLeaveAttachment(file('a.pdf', 'image/png'))).toBeNull();
    expect(validateLeaveAttachment(file('a.exe', 'application/pdf'))).toBe(LEAVE_ATTACHMENT_ERROR);
    expect(validateLeaveAttachment(file('noext', 'application/pdf'))).toBe(LEAVE_ATTACHMENT_ERROR);
    expect(validateLeaveAttachment(file('a.pdf', 'application/pdf', 0))).toBe(
      LEAVE_ATTACHMENT_ERROR
    );
    expect(
      validateLeaveAttachment(file('a.pdf', 'application/pdf', LEAVE_ATTACHMENT_MAX_BYTES + 1))
    ).toBe(LEAVE_ATTACHMENT_ERROR);
    expect(validateLeaveAttachment(file(`${'a'.repeat(200)}.pdf`, 'application/pdf'))).toBe(
      LEAVE_ATTACHMENT_ERROR
    );
  });
});
