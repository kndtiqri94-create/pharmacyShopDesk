import { PayrollAdminFailure, PayrollAdminFailureResult } from '../services/payroll-admin.service';
import { describePayrollFailure } from './payroll-failure.util';

const failure = (
  reason: PayrollAdminFailure,
  extra: Partial<PayrollAdminFailureResult> = {}
): PayrollAdminFailureResult => ({
  ok: false,
  reason,
  errors: {},
  firstErrorField: null,
  ...extra,
});

describe('describePayrollFailure', () => {
  it('closes the dialog for denied and not-found with plain messages', () => {
    expect(describePayrollFailure(failure('denied'), 'Ann')).toEqual({
      errors: {},
      message: 'You do not have access to change salaries.',
      closes: true,
    });
    const gone = describePayrollFailure(failure('not-found'), 'Ann');
    expect(gone.closes).toBeTrue();
    expect(gone.message).toBe('Ann is no longer in the list.');
  });

  it('keeps the dialog open for busy', () => {
    const view = describePayrollFailure(failure('busy'), 'Ann');
    expect(view.closes).toBeFalse();
    expect(view.message).toContain('still saving');
  });

  it('keeps field errors for invalid and a general line', () => {
    const view = describePayrollFailure(
      failure('invalid', { errors: { date: 'Choose a date' }, firstErrorField: 'date' }),
      'Ann'
    );
    expect(view.errors).toEqual({ date: 'Choose a date' });
    expect(view.message).toBe('Check the highlighted fields and try again.');
    expect(view.closes).toBeFalse();
  });

  it('uses the leave rule message for not-allowed and invalid without field errors', () => {
    expect(
      describePayrollFailure(failure('not-allowed', { message: 'No balance left' }), 'Ann').message
    ).toBe('No balance left');
    expect(describePayrollFailure(failure('not-allowed'), 'Ann').message).toBe(
      'Ann cannot be changed here.'
    );
    expect(describePayrollFailure(failure('invalid', { message: 'Overlaps' }), 'Ann').message).toBe(
      'Overlaps'
    );
  });
});
