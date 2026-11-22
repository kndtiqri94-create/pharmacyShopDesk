import { Employee } from '../models/domain/employee.model';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { SalaryType } from '../models/enums/salary-type.enum';
import { EmployeeFormInput, ValidatedEmployee } from './employee-validation.util';
import { employeeFullName } from './employee-list.util';
import { formatRupeesInput } from './money.util';

export function emptyEmployeeDraft(location: string): EmployeeFormInput {
  return {
    title: '',
    code: '',
    location,
    firstName: '',
    middleName: '',
    lastName: '',
    mobile: '',
    email: '',
    dateOfBirth: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    suburb: '',
    state: '',
    country: '',
    zip: '',
    calculateEpf: false,
    calculateEtf: false,
    salaryType: SalaryType.MONTHLY,
    basicSalary: '0',
    allowances: [],
    overTimeRate: '0',
    commissionRate: '0',
    productDiscountRate: '0',
    invoiceDiscountRate: '0',
    monthlyTarget: '0',
    considerAsCustomer: false,
    createUserAccount: false,
    customField1: '',
    customField2: '',
    customField3: '',
    customField4: '',
    status: EmployeeStatus.ACTIVE,
    photoDataUrl: null,
  };
}

export function toDraft(employee: Employee): EmployeeFormInput {
  return {
    title: employee.title,
    code: employee.code,
    location: employee.location,
    firstName: employee.firstName,
    middleName: employee.middleName,
    lastName: employee.lastName,
    mobile: employee.phone,
    email: employee.email,
    dateOfBirth: employee.dateOfBirth ?? '',
    addressLine1: employee.addressLine1,
    addressLine2: employee.addressLine2,
    city: employee.city,
    suburb: employee.suburb,
    state: employee.state,
    country: employee.country,
    zip: employee.zip,
    calculateEpf: employee.calculateEpf,
    calculateEtf: employee.calculateEtf,
    salaryType: employee.salaryType,
    basicSalary: formatRupeesInput(employee.basicSalaryCents),
    allowances: employee.allowances.map(line => ({
      id: line.id,
      name: line.name,
      amount: formatRupeesInput(line.amountCents),
    })),
    overTimeRate: formatRupeesInput(employee.overTimeRateCents),
    commissionRate: String(employee.commissionRate),
    productDiscountRate: String(employee.productDiscountRate),
    invoiceDiscountRate: String(employee.invoiceDiscountRate),
    monthlyTarget: formatRupeesInput(employee.monthlyTargetCents),
    considerAsCustomer: employee.considerAsCustomer,
    createUserAccount: employee.createUserAccount,
    customField1: employee.customField1,
    customField2: employee.customField2,
    customField3: employee.customField3,
    customField4: employee.customField4,
    status: employee.status,
    photoDataUrl: employee.photoDataUrl,
  };
}

export function fromDraft(values: ValidatedEmployee, base: Employee): Employee {
  return {
    ...base,
    code: values.code,
    name: employeeFullName(values),
    phone: values.mobile,
    status: values.status,
    title: values.title,
    firstName: values.firstName,
    middleName: values.middleName,
    lastName: values.lastName,
    email: values.email,
    dateOfBirth: values.dateOfBirth,
    location: values.location,
    addressLine1: values.addressLine1,
    addressLine2: values.addressLine2,
    city: values.city,
    suburb: values.suburb,
    state: values.state,
    country: values.country,
    zip: values.zip,
    calculateEpf: values.calculateEpf,
    calculateEtf: values.calculateEtf,
    salaryType: values.salaryType,
    basicSalaryCents: values.basicSalaryCents,
    allowances: values.allowances.map(line => ({ ...line })),
    overTimeRateCents: values.overTimeRateCents,
    commissionRate: values.commissionRate,
    productDiscountRate: values.productDiscountRate,
    invoiceDiscountRate: values.invoiceDiscountRate,
    monthlyTargetCents: values.monthlyTargetCents,
    considerAsCustomer: values.considerAsCustomer,
    createUserAccount: values.createUserAccount,
    customField1: values.customField1,
    customField2: values.customField2,
    customField3: values.customField3,
    customField4: values.customField4,
    photoDataUrl: values.photoDataUrl,
  };
}

export function isDraftDirty(draft: EmployeeFormInput, baseline: EmployeeFormInput): boolean {
  const { allowances: draftLines, ...draftRest } = draft;
  const { allowances: baselineLines, ...baselineRest } = baseline;
  const restChanged = (Object.keys(baselineRest) as (keyof typeof baselineRest)[]).some(
    key => draftRest[key] !== baselineRest[key]
  );
  if (restChanged || draftLines.length !== baselineLines.length) return true;
  return draftLines.some((line, index) => {
    const original = baselineLines[index];
    return (
      line.id !== original.id || line.name !== original.name || line.amount !== original.amount
    );
  });
}

export function isEmployeeDirty(draft: EmployeeFormInput, saved: Employee): boolean {
  return isDraftDirty(draft, toDraft(saved));
}
