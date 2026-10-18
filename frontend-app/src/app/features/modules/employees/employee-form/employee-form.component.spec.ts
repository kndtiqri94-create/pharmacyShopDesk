import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { EmployeeDataService } from '../../../../core/services/data/employee-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmployeeFormComponent, EmployeeFormMode } from './employee-form.component';

describe('EmployeeFormComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(role: UserRole, mode: EmployeeFormMode, id?: string) {
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode },
              paramMap: convertToParamMap(id ? { id } : {}),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    });
    await signInAs(role);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(EmployeeFormComponent);
    const component = fixture.componentInstance as unknown as {
      loaded(): boolean;
      notFound(): boolean;
    };
    fixture.detectChanges();
    for (
      let attempt = 0;
      attempt < 400 && !component.loaded() && !component.notFound();
      attempt++
    ) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, navigate };
  }

  async function settle(fixture: { detectChanges(): void }): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  const control = (element: HTMLElement, key: string) =>
    element.querySelector(`#employee-${key}`) as HTMLInputElement & HTMLSelectElement;
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;

  function type(
    fixture: { detectChanges(): void },
    element: HTMLElement,
    key: string,
    value: string
  ): void {
    const input = control(element, key);
    input.value = value;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  function fillRequired(fixture: { detectChanges(): void }, element: HTMLElement): void {
    type(fixture, element, 'title', 'Mr.');
    type(fixture, element, 'code', 'EMP-100');
    type(fixture, element, 'firstName', 'Nimal');
    type(fixture, element, 'lastName', 'Perera');
    type(fixture, element, 'mobile', '771234567');
  }

  it('shows the three field groups, defaults and a single primary button for a new employee', async () => {
    const { element } = await render(UserRole.ADMIN, 'create');
    const headings = Array.from(element.querySelectorAll('h2')).map(h => h.textContent?.trim());
    expect(headings).toContain('Basic details');
    expect(headings).toContain('Address');
    expect(headings).toContain('More information');
    expect(control(element, 'status').value).toBe('ACTIVE');
    expect(control(element, 'location').value).toBe('Main Shop');
    const toggles = Array.from(element.querySelectorAll('[role="switch"]'));
    expect(toggles.length).toBe(4);
    expect(toggles.every(toggle => toggle.getAttribute('aria-checked') === 'false')).toBeTrue();
    expect(buttonByText(element, 'Save employee')).toBeDefined();
  });

  it('marks required fields and associates every label with its control', async () => {
    const { element } = await render(UserRole.ADMIN, 'create');
    for (const key of ['title', 'code', 'location', 'firstName', 'lastName', 'mobile']) {
      const label = element.querySelector(`label[for="employee-${key}"]`);
      expect(label?.textContent).toContain('*');
      expect(control(element, key)).not.toBeNull();
    }
  });

  it('shows errors and focuses the first invalid field when saving an empty form', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    buttonByText(element, 'Save employee')!.click();
    await settle(fixture);
    expect(element.querySelector('#employee-title-error')?.textContent).toContain('Choose a title');
    expect(element.querySelector('#employee-code-error')).not.toBeNull();
    expect(document.activeElement).toBe(control(element, 'title'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is changed', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'create');
    buttonByText(element, 'Save employee')!.click();
    await settle(fixture);
    type(fixture, element, 'title', 'Mr.');
    expect(element.querySelector('#employee-title-error')).toBeNull();
  });

  it('rejects a duplicate EMP Code in any letter case', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'create');
    fillRequired(fixture, element);
    type(fixture, element, 'code', 'emp-001');
    buttonByText(element, 'Save employee')!.click();
    await settle(fixture);
    expect(element.querySelector('#employee-code-error')?.textContent).toContain('already in use');
  });

  it('saves a new employee, confirms and goes back to the list', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    fillRequired(fixture, element);
    buttonByText(element, 'Save employee')!.click();
    await settle(fixture);
    const saved = (await firstValueFrom(TestBed.inject(EmployeeDataService).getAll())).find(
      employee => employee.code === 'EMP-100'
    );
    expect(saved?.name).toBe('Nimal Perera');
    expect(TestBed.inject(NotificationService).current()?.message).toBe('Nimal Perera was saved.');
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('reminds about the user account and links to Users with the employee chosen', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    fillRequired(fixture, element);
    (
      Array.from(element.querySelectorAll('[role="switch"]')).find(toggle =>
        toggle.textContent?.includes('Create user account')
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    buttonByText(element, 'Save employee')!.click();
    await settle(fixture);
    expect(navigate).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Finish the user account');
    const saved = (await firstValueFrom(TestBed.inject(EmployeeDataService).getAll())).find(
      employee => employee.code === 'EMP-100'
    );
    buttonByText(element, 'Go to Users')!.click();
    expect(navigate).toHaveBeenCalledWith(['/users'], { queryParams: { employeeId: saved?.id } });
  });

  it('closes straight away on Cancel when nothing changed', async () => {
    const { element, navigate } = await render(UserRole.ADMIN, 'create');
    buttonByText(element, 'Cancel')!.click();
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('asks before leaving with unsaved changes and keeps editing on request', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    type(fixture, element, 'firstName', 'Nimal');
    buttonByText(element, 'Cancel')!.click();
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(element.querySelector('dialog')?.hasAttribute('open')).toBeTrue();
    buttonByText(element, 'Keep editing')!.click();
    fixture.detectChanges();
    expect(control(element, 'firstName').value).toBe('Nimal');
    buttonByText(element, 'Cancel')!.click();
    fixture.detectChanges();
    buttonByText(element, 'Leave without saving')!.click();
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('loads an existing employee for editing and saves the change', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'edit', 'emp-005');
    expect(control(element, 'code').value).toBe('EMP-005');
    type(fixture, element, 'customField1', 'Night cover');
    buttonByText(element, 'Save employee')!.click();
    await settle(fixture);
    const saved = await firstValueFrom(TestBed.inject(EmployeeDataService).getById('emp-005'));
    expect(saved?.customField1).toBe('Night cover');
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('shows already linked instead of a Create user account toggle for a linked employee', async () => {
    const { element } = await render(UserRole.ADMIN, 'edit', 'emp-003');
    expect(element.textContent).toContain('Already linked to a user account');
    const labels = Array.from(element.querySelectorAll('[role="switch"]')).map(
      toggle => toggle.textContent
    );
    expect(labels.some(text => text?.includes('Create user account'))).toBeFalse();
  });

  it('shows the view page read-only with no Save button', async () => {
    const { element } = await render(UserRole.MANAGER, 'view', 'emp-005');
    expect(buttonByText(element, 'Save employee')).toBeUndefined();
    expect(element.textContent).toContain('View only');
    expect(control(element, 'firstName').readOnly).toBeTrue();
    expect(control(element, 'title').disabled).toBeTrue();
    expect(
      Array.from(element.querySelectorAll<HTMLButtonElement>('[role="switch"]')).every(
        toggle => toggle.disabled
      )
    ).toBeTrue();
  });

  it('shows the salary section read-only for a Manager, with the allowance total', async () => {
    const { element } = await render(UserRole.MANAGER, 'view', 'emp-005');
    expect(element.textContent).toContain('Employee salaries and allowances');
    expect(control(element, 'basicSalary').readOnly).toBeTrue();
    expect(element.textContent).not.toContain('Add allowance');
    expect(element.querySelector('#employee-allowances-total')?.textContent).toContain('Rs. ');
    expect(element.querySelector('input[type="file"]')).toBeNull();
  });

  it('flags an incomplete allowance line and focuses it on save', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'create');
    fillRequired(fixture, element);
    buttonByText(element, 'Add allowance')!.click();
    fixture.detectChanges();
    buttonByText(element, 'Save employee')!.click();
    await settle(fixture);
    expect(element.querySelector('#employee-allowance-0-name-error')).not.toBeNull();
    expect(element.querySelector('#employee-allowance-0-amount-error')).not.toBeNull();
    expect(document.activeElement).toBe(control(element, 'allowance-0-name'));
  });

  it('removes an allowance line when saved', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'edit', 'emp-005');
    element.querySelector<HTMLButtonElement>('button[aria-label="Remove allowance 1"]')!.click();
    fixture.detectChanges();
    expect(control(element, 'allowance-0-name')).toBeNull();
    const store = TestBed.inject(EmployeeDataService);
    expect((await firstValueFrom(store.getById('emp-005')))!.allowances.length).toBe(1);
    buttonByText(element, 'Save employee')!.click();
    await settle(fixture);
    expect((await firstValueFrom(store.getById('emp-005')))!.allowances.length).toBe(0);
  });

  it('keeps the original allowance lines when Cancel discards a removal', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'edit', 'emp-005');
    element.querySelector<HTMLButtonElement>('button[aria-label="Remove allowance 1"]')!.click();
    fixture.detectChanges();
    buttonByText(element, 'Cancel')!.click();
    fixture.detectChanges();
    buttonByText(element, 'Leave without saving')!.click();
    const saved = await firstValueFrom(TestBed.inject(EmployeeDataService).getById('emp-005'));
    expect(saved!.allowances.length).toBe(1);
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('places the picture field in More information and writes the chosen picture to the draft', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'create');
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.closest('app-employee-more-section')).not.toBeNull();
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(element.querySelector('img')?.getAttribute('src')).toContain('data:image/png');
    buttonByText(element, 'Remove')!.click();
    fixture.detectChanges();
    expect(element.querySelector('img')).toBeNull();
  });

  it('sends a read-only user away from the create page', async () => {
    const { navigate } = await render(UserRole.MANAGER, 'create');
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('shows a not found message for an unknown employee', async () => {
    const { element } = await render(UserRole.ADMIN, 'edit', 'emp-999');
    expect(element.textContent).toContain('That employee is not in your list');
    expect(element.querySelector('form')).toBeNull();
  });

  it('shows a not found message for a malformed id', async () => {
    const { element } = await render(UserRole.ADMIN, 'view', '<script>');
    expect(element.textContent).toContain('That employee is not in your list');
  });
});
