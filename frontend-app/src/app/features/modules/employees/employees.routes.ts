import { Routes } from '@angular/router';
import { moduleAccessActivateGuard } from '../../../core/guards/module-access.guard';
import { moduleWriteGuard } from '../../../core/guards/module-write.guard';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';

const loadForm = () =>
  import('./employee-form/employee-form.component').then(file => file.EmployeeFormComponent);

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    title: 'Employees',
    data: { module: ModuleKey.EMPLOYEES },
    loadComponent: () => import('./employees.component').then(file => file.EmployeesComponent),
  },
  {
    path: 'new',
    title: 'Add employee',
    canActivate: [moduleAccessActivateGuard, moduleWriteGuard],
    data: { module: ModuleKey.EMPLOYEES, mode: 'create', viewOnlyRedirect: '/employees' },
    loadComponent: loadForm,
  },
  {
    path: 'leave/apply',
    title: 'Apply for leave',
    canActivate: [moduleAccessActivateGuard, moduleWriteGuard],
    data: { module: ModuleKey.EMPLOYEES, viewOnlyRedirect: '/employees' },
    loadComponent: () =>
      import('./leave-application/leave-application.component').then(
        file => file.LeaveApplicationComponent
      ),
  },
  {
    path: 'payroll',
    title: 'Employees salaries',
    canActivate: [moduleAccessActivateGuard],
    data: { module: ModuleKey.PAYROLL },
    loadComponent: () => import('./payroll/payroll.component').then(file => file.PayrollComponent),
  },
  {
    path: ':id/edit',
    title: 'Edit employee',
    canActivate: [moduleAccessActivateGuard, moduleWriteGuard],
    data: { module: ModuleKey.EMPLOYEES, mode: 'edit', viewOnlyRedirect: '/employees/:id' },
    loadComponent: loadForm,
  },
  {
    path: ':id',
    title: 'Employee',
    canActivate: [moduleAccessActivateGuard],
    data: { module: ModuleKey.EMPLOYEES, mode: 'view' },
    loadComponent: loadForm,
  },
];
