import { AppUser } from '../models/domain/app-user.model';
import { Employee } from '../models/domain/employee.model';
import { ALL_USER_ROLES, UserRole } from '../models/enums/user-role.enum';

export const USER_FIELD_LIMITS = {
  username: 100,
  passwordMin: 8,
  passwordMax: 100,
  pinLength: 4,
} as const;

const FIELD_ORDER = ['employeeId', 'username', 'role', 'password', 'pin'] as const;

export type UserFieldErrors = Record<string, string>;

export interface UserFormInput {
  employeeId: string;
  username: string;
  role: string;
  password: string;
  pin: string;
  mustChangePassword: boolean;
}

export interface UserValidationContext {
  employees: readonly Employee[];
  users: readonly AppUser[];
}

export interface ValidatedUser {
  employeeId: string;
  username: string;
  role: UserRole;
  password: string;
  pin: string | null;
  mustChangePassword: boolean;
}

export interface UserValidationResult {
  errors: UserFieldErrors;
  firstErrorField: string | null;
  values: ValidatedUser | null;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function employeeOption(employee: Employee): string {
  return `${employee.name} (${employee.code})`;
}

export function availableEmployees(
  employees: readonly Employee[],
  users: readonly AppUser[]
): Employee[] {
  return employees.filter(
    employee => employee.userId === null && !users.some(user => user.employeeId === employee.id)
  );
}

export function isUserRole(value: string): value is UserRole {
  return (ALL_USER_ROLES as readonly string[]).includes(value);
}

function isFourDigits(text: string): boolean {
  return (
    text.length === USER_FIELD_LIMITS.pinLength &&
    [...text].every(char => char >= '0' && char <= '9')
  );
}

function checkEmployee(
  errors: UserFieldErrors,
  input: UserFormInput,
  context: UserValidationContext
): void {
  if (input.employeeId === '') {
    errors['employeeId'] = 'Choose the employee this sign-in is for';
    return;
  }
  const eligible = availableEmployees(context.employees, context.users);
  if (!eligible.some(employee => employee.id === input.employeeId)) {
    errors['employeeId'] = 'Choose an employee who does not have a sign-in yet';
  }
}

function checkUsername(
  errors: UserFieldErrors,
  input: UserFormInput,
  context: UserValidationContext
): void {
  const username = normalizeUsername(input.username);
  if (username.length === 0) {
    errors['username'] = 'Enter a username or email';
  } else if (username.length > USER_FIELD_LIMITS.username) {
    errors['username'] =
      `Username or email must be ${USER_FIELD_LIMITS.username} characters or fewer`;
  } else if (/\s/.test(username)) {
    errors['username'] = 'Username or email cannot contain spaces';
  } else if (context.users.some(user => normalizeUsername(user.username) === username)) {
    errors['username'] = 'That username or email is already used. Choose another';
  }
}

function checkPassword(errors: UserFieldErrors, password: string): void {
  if (password.length === 0) {
    errors['password'] = 'Enter a temporary password';
  } else if (password.length < USER_FIELD_LIMITS.passwordMin) {
    errors['password'] =
      `The temporary password must be at least ${USER_FIELD_LIMITS.passwordMin} characters`;
  } else if (password.length > USER_FIELD_LIMITS.passwordMax) {
    errors['password'] =
      `The temporary password must be ${USER_FIELD_LIMITS.passwordMax} characters or fewer`;
  }
}

export function validateUser(
  input: UserFormInput,
  context: UserValidationContext
): UserValidationResult {
  const errors: UserFieldErrors = {};
  checkEmployee(errors, input, context);
  checkUsername(errors, input, context);
  if (!isUserRole(input.role)) errors['role'] = 'Choose a role';
  checkPassword(errors, input.password);
  if (input.pin !== '' && !isFourDigits(input.pin)) {
    errors['pin'] = 'The Quick PIN must be exactly 4 digits';
  }
  const firstErrorField = FIELD_ORDER.find(field => errors[field] !== undefined) ?? null;
  if (firstErrorField !== null || !isUserRole(input.role)) {
    return { errors, firstErrorField, values: null };
  }
  return {
    errors,
    firstErrorField: null,
    values: {
      employeeId: input.employeeId,
      username: normalizeUsername(input.username),
      role: input.role,
      password: input.password,
      pin: input.pin === '' ? null : input.pin,
      mustChangePassword: input.mustChangePassword,
    },
  };
}
