import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import { USER_SEED } from '../services/data/in-memory/seed/user.seed';
import {
  UserFormInput,
  availableEmployees,
  employeeOption,
  validateUser,
} from './user-validation.util';

const context = { employees: EMPLOYEE_SEED, users: USER_SEED };

const valid: UserFormInput = {
  employeeId: 'emp-005',
  username: 'Suresh',
  role: 'CASHIER',
  password: 'Welcome-1',
  pin: '',
  mustChangePassword: true,
};

describe('user-validation.util', () => {
  it('accepts valid details and normalises the username', () => {
    const result = validateUser({ ...valid, pin: '1234' }, context);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({
      employeeId: 'emp-005',
      username: 'suresh',
      role: 'CASHIER',
      password: 'Welcome-1',
      pin: '1234',
      mustChangePassword: true,
    });
  });

  it('treats an empty Quick PIN as none', () => {
    expect(validateUser(valid, context).values?.pin).toBeNull();
  });

  it('asks for every required field and reports the first problem in form order', () => {
    const result = validateUser(
      {
        employeeId: '',
        username: '  ',
        role: '',
        password: '',
        pin: '',
        mustChangePassword: false,
      },
      context
    );
    expect(result.values).toBeNull();
    expect(result.errors).toEqual({
      employeeId: 'Choose the employee this sign-in is for',
      username: 'Enter a username or email',
      role: 'Choose a role',
      password: 'Enter a temporary password',
    });
    expect(result.firstErrorField).toBe('employeeId');
  });

  it('puts focus on the first problem field further down the form', () => {
    expect(validateUser({ ...valid, password: 'short' }, context).firstErrorField).toBe('password');
    expect(validateUser({ ...valid, pin: '12' }, context).firstErrorField).toBe('pin');
    expect(validateUser({ ...valid, username: '', pin: '1' }, context).firstErrorField).toBe(
      'username'
    );
  });

  it('rejects a username that is already used, ignoring case and spaces', () => {
    for (const username of ['nimal', ' NIMAL ', 'Kamal']) {
      const result = validateUser({ ...valid, username }, context);
      expect(result.errors['username']).toBe(
        'That username or email is already used. Choose another'
      );
    }
  });

  it('rejects spaces inside the username and over-long usernames', () => {
    expect(validateUser({ ...valid, username: 'a b' }, context).errors['username']).toBe(
      'Username or email cannot contain spaces'
    );
    expect(validateUser({ ...valid, username: 'a'.repeat(101) }, context).errors['username']).toBe(
      'Username or email must be 100 characters or fewer'
    );
  });

  it('requires a password of 8 to 100 characters', () => {
    expect(validateUser({ ...valid, password: '1234567' }, context).errors['password']).toBe(
      'The temporary password must be at least 8 characters'
    );
    expect(
      validateUser({ ...valid, password: '12345678' }, context).errors['password']
    ).toBeUndefined();
    expect(validateUser({ ...valid, password: 'x'.repeat(101) }, context).errors['password']).toBe(
      'The temporary password must be 100 characters or fewer'
    );
  });

  it('requires a Quick PIN, when given, to be exactly 4 digits', () => {
    for (const pin of ['123', '12345', 'abcd', '12a4', '１２３４', '1 23']) {
      expect(validateUser({ ...valid, pin }, context).errors['pin'])
        .withContext(pin)
        .toBe('The Quick PIN must be exactly 4 digits');
    }
    expect(validateUser({ ...valid, pin: '0042' }, context).errors['pin']).toBeUndefined();
  });

  it('rejects an unknown role, an unknown employee and one that already has a sign-in', () => {
    expect(validateUser({ ...valid, role: 'OWNER' }, context).errors['role']).toBe('Choose a role');
    expect(validateUser({ ...valid, employeeId: 'emp-999' }, context).errors['employeeId']).toBe(
      'Choose an employee who does not have a sign-in yet'
    );
    expect(validateUser({ ...valid, employeeId: 'emp-001' }, context).errors['employeeId']).toBe(
      'Choose an employee who does not have a sign-in yet'
    );
  });

  it('does not offer inactive employees', () => {
    const inactive = EMPLOYEE_SEED.find(employee => employee.status === 'INACTIVE');
    expect(inactive).toBeDefined();
    expect(availableEmployees(EMPLOYEE_SEED, USER_SEED).map(employee => employee.id)).not.toContain(
      inactive!.id
    );
  });

  it('offers only employees without a sign-in, shown with name and ID', () => {
    const available = availableEmployees(EMPLOYEE_SEED, USER_SEED);
    expect(available.map(employee => employee.code)).toEqual(['EMP-005', 'EMP-006', 'EMP-007']);
    expect(employeeOption(available[0])).toBe('Suresh Kumar (EMP-005)');
  });
});
