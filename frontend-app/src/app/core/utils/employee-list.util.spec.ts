import { Employee } from '../models/domain/employee.model';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import {
  buildEmployeeList,
  defaultEmployeeCriteria,
  employeeAddressLine,
  employeeFullName,
  filterEmployees,
  formatEntriesText,
  listLocations,
  paginateEmployees,
  parseCreatedDate,
  parseEmployeePageSize,
  parseEmployeeStatusFilter,
  sortNewestFirst,
} from './employee-list.util';

function make(index: number): Employee {
  return {
    ...EMPLOYEE_SEED[0],
    id: `x-${index}`,
    code: `X-${index}`,
    createdAt: `2026-08-${String(index).padStart(2, '0')}T08:00:00.000Z`,
  };
}

describe('employee list', () => {
  const criteria = defaultEmployeeCriteria();

  it('returns everything for default criteria', () => {
    expect(filterEmployees(EMPLOYEE_SEED, criteria).length).toBe(EMPLOYEE_SEED.length);
  });

  it('matches the keyword on code, name, mobile and email ignoring capitals', () => {
    const byKeyword = (keyword: string) =>
      filterEmployees(EMPLOYEE_SEED, { ...criteria, keyword }).map(employee => employee.id);
    expect(byKeyword('EMP-001')).toEqual(['emp-001']);
    expect(byKeyword('nimal PERERA')).toContain('emp-001');
    expect(byKeyword('100 0002')).toEqual(['emp-002']);
    expect(byKeyword('KAMAL.SILVA@')).toEqual(['emp-002']);
    expect(byKeyword('  zzz-no-match  ')).toEqual([]);
  });

  it('filters by status literally', () => {
    const ids = (status: 'active' | 'inactive') =>
      filterEmployees(EMPLOYEE_SEED, { ...criteria, status }).map(employee => employee.id);
    expect(ids('inactive')).toEqual(['emp-008']);
    expect(ids('active')).not.toContain('emp-008');
  });

  it('filters by location', () => {
    const other = { ...EMPLOYEE_SEED[0], id: 'o', location: 'Branch' };
    const result = filterEmployees([...EMPLOYEE_SEED, other], { ...criteria, location: 'Branch' });
    expect(result.map(employee => employee.id)).toEqual(['o']);
  });

  it('filters by created at range with either end empty', () => {
    const ids = (createdFrom: string, createdTo: string) =>
      filterEmployees(EMPLOYEE_SEED, { ...criteria, createdFrom, createdTo }).map(
        employee => employee.id
      );
    expect(ids('2026-07-14', '')).toEqual(['emp-008']);
    expect(ids('', '2026-01-05')).toEqual(['emp-001']);
    expect(ids('2026-01-12', '2026-02-03')).toEqual(['emp-002', 'emp-003']);
    expect(ids('2026-02-04', '2026-02-03')).toEqual([]);
  });

  it('applies several filters together', () => {
    const result = filterEmployees(EMPLOYEE_SEED, {
      ...criteria,
      keyword: 'emp',
      status: 'active',
      createdFrom: '2026-05-01',
    });
    expect(result.map(employee => employee.id)).toEqual(['emp-006', 'emp-007']);
  });

  it('keeps a stored On leave employee under Active, never Inactive', () => {
    const idsFor = (status: 'active' | 'inactive') =>
      filterEmployees(EMPLOYEE_SEED, { ...criteria, status }).map(employee => employee.id);
    expect(idsFor('active')).toContain('emp-007');
    expect(idsFor('inactive')).toEqual(['emp-008']);
  });

  it('sorts newest created first without changing the input', () => {
    const input = [make(3), make(9), make(5)];
    expect(sortNewestFirst(input).map(employee => employee.id)).toEqual(['x-9', 'x-5', 'x-3']);
    expect(input[0].id).toBe('x-3');
    expect(buildEmployeeList(EMPLOYEE_SEED, criteria)[0].id).toBe('emp-008');
  });

  it('pages and words the entries text', () => {
    const rows = Array.from({ length: 23 }, (_, index) => make(index + 1));
    const first = paginateEmployees(rows, 1, 10);
    expect(first.rows.length).toBe(10);
    expect(first.entriesText).toBe('Showing 1 to 10 of 23 entries');
    const last = paginateEmployees(rows, 3, 10);
    expect(last.rows.length).toBe(3);
    expect(last.entriesText).toBe('Showing 21 to 23 of 23 entries');
    expect(paginateEmployees(rows, 99, 10).page).toBe(3);
    expect(paginateEmployees(rows, 0, 10).page).toBe(1);
    expect(paginateEmployees(rows, 1, 25).pageCount).toBe(1);
    expect(paginateEmployees(rows, 1, 7).rows.length).toBe(10);
  });

  it('reads 0 to 0 of 0 when empty', () => {
    expect(paginateEmployees([], 1, 10).entriesText).toBe('Showing 0 to 0 of 0 entries');
    expect(formatEntriesText(1, 10, 0)).toBe('Showing 0 to 0 of 0 entries');
    expect(paginateEmployees([], 5, 10).page).toBe(1);
  });

  it('formats names and addresses', () => {
    expect(employeeFullName({ firstName: 'A', middleName: '', lastName: 'B' })).toBe('A B');
    expect(employeeFullName({ firstName: 'A', middleName: ' M ', lastName: 'B' })).toBe('A M B');
    const address = employeeAddressLine({
      addressLine1: '12 Lake Rd',
      addressLine2: '',
      city: 'Colombo',
      suburb: '',
      state: 'Western',
      country: 'Sri Lanka',
      zip: '10100',
    });
    expect(address).toBe('12 Lake Rd, Colombo, Western, Sri Lanka, 10100');
  });

  it('lists distinct locations and parses controls safely', () => {
    expect(listLocations(EMPLOYEE_SEED)).toEqual(['Main Pharmacy']);
    expect(parseEmployeeStatusFilter('inactive')).toBe('inactive');
    expect(parseEmployeeStatusFilter('<script>')).toBe('all');
    expect(parseEmployeeStatusFilter(null)).toBe('all');
    expect(parseEmployeePageSize(25)).toBe(25);
    expect(parseEmployeePageSize(1000)).toBe(10);
  });

  it('accepts only a plain yyyy-mm-dd day for the Created at filter', () => {
    expect(parseCreatedDate('2026-07-14')).toBe('2026-07-14');
    expect(parseCreatedDate('')).toBe('');
    expect(parseCreatedDate('14/07/2026')).toBe('');
    expect(parseCreatedDate('2026-07-14<script>')).toBe('');
  });
});
