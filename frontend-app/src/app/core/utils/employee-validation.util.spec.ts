import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import { emptyEmployeeDraft, toDraft } from './employee-diff.util';
import {
  allowanceFieldKey,
  EmployeeFormInput,
  EmployeeValidationContext,
  validateEmployee,
} from './employee-validation.util';

const CONTEXT: EmployeeValidationContext = {
  employees: EMPLOYEE_SEED,
  editingId: null,
  today: '2026-10-18',
};

function validDraft(overrides: Partial<EmployeeFormInput> = {}): EmployeeFormInput {
  return {
    ...emptyEmployeeDraft('Main Pharmacy'),
    title: 'Mr.',
    code: 'EMP-100',
    firstName: 'Ashan',
    lastName: 'Silva',
    mobile: '77 123 4567',
    ...overrides,
  };
}

describe('employee validation', () => {
  it('accepts a minimal valid employee and parses values once', () => {
    const result = validateEmployee(
      validDraft({ basicSalary: '1500.50', commissionRate: '12.5' }),
      CONTEXT
    );
    expect(result.firstErrorField).toBeNull();
    expect(result.values?.mobile).toBe('771234567');
    expect(result.values?.basicSalaryCents).toBe(150050);
    expect(result.values?.commissionRate).toBe(12.5);
    expect(result.values?.dateOfBirth).toBeNull();
  });

  it('requires title, code, location, first name, last name and mobile in order', () => {
    const result = validateEmployee(emptyEmployeeDraft(''), CONTEXT);
    expect(Object.keys(result.errors)).toEqual([
      'title',
      'code',
      'location',
      'firstName',
      'lastName',
      'mobile',
    ]);
    expect(result.firstErrorField).toBe('title');
    expect(result.values).toBeNull();
  });

  it('checks the EMP Code format', () => {
    for (const code of ['A', 'a'.repeat(21), 'EMP 1', 'EMP/1', 'ÉMP-1']) {
      expect(validateEmployee(validDraft({ code }), CONTEXT).errors['code']).toContain('2 to 20');
    }
    expect(validateEmployee(validDraft({ code: 'ab_-9' }), CONTEXT).errors['code']).toBeUndefined();
  });

  it('rejects a duplicate code ignoring capitals and spaces, but accepts the own code', () => {
    const taken = validateEmployee(validDraft({ code: '  emp-001 ' }), CONTEXT);
    expect(taken.errors['code']).toContain('already in use');
    const own = validateEmployee(validDraft({ code: 'emp-001' }), {
      ...CONTEXT,
      editingId: 'emp-001',
    });
    expect(own.errors['code']).toBeUndefined();
  });

  it('counts an inactive employee code as taken', () => {
    const inactive = EMPLOYEE_SEED.find(employee => employee.id === 'emp-008')!;
    const result = validateEmployee(validDraft({ code: inactive.code }), CONTEXT);
    expect(result.errors['code']).toContain('already in use');
  });

  it('limits name lengths', () => {
    const result = validateEmployee(
      validDraft({
        firstName: 'a'.repeat(51),
        middleName: 'b'.repeat(51),
        lastName: 'c'.repeat(51),
      }),
      CONTEXT
    );
    expect(Object.keys(result.errors)).toEqual(['firstName', 'middleName', 'lastName']);
  });

  it('needs a 9 digit mobile, spaces ignored', () => {
    for (const mobile of ['7712345', '77123456789', '77abc4567', '+94771234567', '7712 3456 7 8']) {
      expect(validateEmployee(validDraft({ mobile }), CONTEXT).errors['mobile']).toContain(
        '77XXXXXXX'
      );
    }
    expect(
      validateEmployee(validDraft({ mobile: '771234567' }), CONTEXT).errors['mobile']
    ).toBeUndefined();
  });

  it('rejects a ten digit mobile with a leading zero', () => {
    const result = validateEmployee(validDraft({ mobile: '077 100 0001' }), CONTEXT);
    expect(result.errors['mobile']).toContain('9 digits');
  });

  it('strips spaces from a valid nine digit mobile', () => {
    const result = validateEmployee(validDraft({ mobile: '77 100 0001' }), CONTEXT);
    expect(result.errors['mobile']).toBeUndefined();
    expect(result.values?.mobile).toBe('771000001');
  });

  it('checks the email shape only when given', () => {
    expect(validateEmployee(validDraft({ email: '' }), CONTEXT).errors['email']).toBeUndefined();
    expect(
      validateEmployee(validDraft({ email: 'a@b.lk' }), CONTEXT).errors['email']
    ).toBeUndefined();
    for (const email of [
      'abc',
      'a@b',
      'a b@c.lk',
      '@c.lk',
      'a@@c.lk',
      'a@c..lk',
      `${'a'.repeat(100)}@c.lk`,
    ]) {
      expect(validateEmployee(validDraft({ email }), CONTEXT).errors['email']).toBeDefined();
    }
  });

  it('checks the date of birth', () => {
    const errorFor = (dateOfBirth: string) =>
      validateEmployee(validDraft({ dateOfBirth }), CONTEXT).errors['dateOfBirth'];
    expect(errorFor('2026-10-19')).toContain('future');
    expect(errorFor('2026-02-30')).toContain('real');
    expect(errorFor('not a date')).toContain('real');
    expect(errorFor('1850-01-01')).toContain('real');
    expect(errorFor('2026-10-18')).toBeUndefined();
    expect(errorFor('1990-05-05')).toBeUndefined();
  });

  it('keeps percentages between 0 and 100', () => {
    for (const value of ['-1', '101', 'abc', '1e2', '100.01', '10.123', 'NaN']) {
      const result = validateEmployee(
        validDraft({
          commissionRate: value,
          productDiscountRate: value,
          invoiceDiscountRate: value,
        }),
        CONTEXT
      );
      expect(Object.keys(result.errors)).toEqual([
        'commissionRate',
        'productDiscountRate',
        'invoiceDiscountRate',
      ]);
    }
    const edge = validateEmployee(
      validDraft({ commissionRate: '0', productDiscountRate: '100', invoiceDiscountRate: '99.99' }),
      CONTEXT
    );
    expect(edge.values?.productDiscountRate).toBe(100);
  });

  it('rejects bad money values and treats empty as zero', () => {
    for (const value of ['-5', 'abc', '1e3', '12.345', '99999999999999999']) {
      const result = validateEmployee(
        validDraft({ basicSalary: value, overTimeRate: value, monthlyTarget: value }),
        CONTEXT
      );
      expect(Object.keys(result.errors)).toEqual(['basicSalary', 'overTimeRate', 'monthlyTarget']);
    }
    const empty = validateEmployee(validDraft({ basicSalary: '', overTimeRate: ' ' }), CONTEXT);
    expect(empty.values?.basicSalaryCents).toBe(0);
    expect(empty.values?.overTimeRateCents).toBe(0);
  });

  it('checks each allowance line and reports the first error by line', () => {
    const result = validateEmployee(
      validDraft({
        allowances: [
          { id: 'a1', name: 'Meal', amount: '300' },
          { id: 'a2', name: ' ', amount: '10' },
          { id: 'a3', name: 'Fuel', amount: '0' },
          { id: 'a4', name: 'Bonus', amount: '' },
          { id: 'a5', name: 'Phone', amount: '-4' },
          { id: 'a6', name: 'Rent', amount: 'abc' },
        ],
      }),
      CONTEXT
    );
    expect(result.errors[allowanceFieldKey(0, 'name')]).toBeUndefined();
    expect(result.errors[allowanceFieldKey(1, 'name')]).toBeDefined();
    for (const index of [2, 3, 4, 5]) {
      expect(result.errors[allowanceFieldKey(index, 'amount')]).toContain('above zero');
    }
    expect(result.firstErrorField).toBe(allowanceFieldKey(1, 'name'));
  });

  it('converts valid allowances to cents and caps the number of lines', () => {
    const ok = validateEmployee(
      validDraft({ allowances: [{ id: 'a1', name: ' Meal ', amount: '300.25' }] }),
      CONTEXT
    );
    expect(ok.values?.allowances).toEqual([{ id: 'a1', name: 'Meal', amountCents: 30025 }]);
    const lines = Array.from({ length: 21 }, (_, index) => ({
      id: `a${index}`,
      name: 'Meal',
      amount: '1',
    }));
    expect(
      validateEmployee(validDraft({ allowances: lines }), CONTEXT).errors['allowances']
    ).toBeDefined();
  });

  it('limits custom field length', () => {
    const result = validateEmployee(
      validDraft({ customField1: 'x'.repeat(101), customField4: 'y'.repeat(100) }),
      CONTEXT
    );
    expect(Object.keys(result.errors)).toEqual(['customField1']);
  });

  it('rejects unknown title, status, salary type and non image photo', () => {
    const result = validateEmployee(
      validDraft({
        title: 'Lord',
        status: 'GONE',
        salaryType: 'WEEKLY',
        photoDataUrl: 'data:text/html;base64,AAAA',
      }),
      CONTEXT
    );
    expect(Object.keys(result.errors)).toEqual(['title', 'status', 'salaryType', 'photo']);
  });

  it('validates a seeded employee draft unchanged', () => {
    for (const employee of EMPLOYEE_SEED) {
      const result = validateEmployee(toDraft(employee), { ...CONTEXT, editingId: employee.id });
      expect(result.errors).toEqual({});
    }
  });
});
