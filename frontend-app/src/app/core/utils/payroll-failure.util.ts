import { PayrollAdminFailureResult } from '../services/payroll-admin.service';
import { PayrollFieldErrors } from './payroll-validation.util';

export interface PayrollFailureView {
  errors: PayrollFieldErrors;
  message: string;
  closes: boolean;
}

export function describePayrollFailure(
  failure: PayrollAdminFailureResult,
  employeeName: string
): PayrollFailureView {
  const hasFieldErrors = Object.keys(failure.errors).length > 0;
  switch (failure.reason) {
    case 'denied':
      return {
        errors: {},
        message: 'You do not have access to change salaries.',
        closes: true,
      };
    case 'not-found':
      return {
        errors: {},
        message: `${employeeName} is no longer in the list.`,
        closes: true,
      };
    case 'busy':
      return {
        errors: {},
        message: 'Another change is still saving. Try again.',
        closes: false,
      };
    case 'not-allowed':
      return {
        errors: failure.errors,
        message: failure.message ?? `${employeeName} cannot be changed here.`,
        closes: false,
      };
    default:
      return {
        errors: failure.errors,
        message: hasFieldErrors
          ? 'Check the highlighted fields and try again.'
          : (failure.message ?? 'Check the details and try again.'),
        closes: false,
      };
  }
}
