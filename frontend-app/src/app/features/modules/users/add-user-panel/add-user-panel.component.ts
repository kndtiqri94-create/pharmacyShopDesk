import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppUser } from '../../../../core/models/domain/app-user.model';
import { Employee } from '../../../../core/models/domain/employee.model';
import { ALL_USER_ROLES } from '../../../../core/models/enums/user-role.enum';
import { UserAdminService } from '../../../../core/services/user-admin.service';
import {
  USER_FIELD_LIMITS,
  UserFieldErrors,
  employeeOption,
} from '../../../../core/utils/user-validation.util';
import { formatUserRoleLabel } from '../../../../core/utils/user-role-label.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { SidePanelComponent } from '../../../../shared/components/side-panel/side-panel.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';

const FIELD_ID_PREFIX = 'add-user-';

@Component({
  selector: 'app-add-user-panel',
  imports: [
    ...FIELD_IMPORTS,
    ButtonComponent,
    ReactiveFormsModule,
    SidePanelComponent,
    ToggleComponent,
  ],
  templateUrl: './add-user-panel.component.html',
  styleUrl: './add-user-panel.component.scss',
})
export class AddUserPanelComponent {
  readonly open = input(false);
  readonly employees = input.required<readonly Employee[]>();
  readonly created = output<AppUser>();
  readonly cancelled = output<void>();

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly userAdminService = inject(UserAdminService);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly limits = USER_FIELD_LIMITS;
  protected readonly roles = ALL_USER_ROLES;
  protected readonly roleLabel = formatUserRoleLabel;
  protected readonly employeeOption = employeeOption;
  protected readonly form = this.formBuilder.group({
    employeeId: '',
    username: '',
    role: '',
    password: '',
    pin: '',
    mustChangePassword: true,
  });
  protected readonly errors = signal<UserFieldErrors>({});
  protected readonly saving = signal(false);
  protected readonly initialFocus = computed(() => `#${this.fieldId('employeeId')}`);

  constructor() {
    effect(() => {
      if (!this.open()) this.clear();
    });
  }

  protected fieldId(key: string): string {
    return `${FIELD_ID_PREFIX}${key}`;
  }

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }

  protected cancel(): void {
    this.clear();
    this.cancelled.emit();
  }

  protected create(): void {
    this.submit().catch(() => this.saving.set(false));
  }

  private async submit(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const result = await this.userAdminService.createUser(this.form.getRawValue());
    this.saving.set(false);
    if (result.ok) {
      this.clear();
      this.created.emit(result.user);
      return;
    }
    this.errors.set(result.errors);
    if (result.firstErrorField !== null) {
      this.hostElement.nativeElement
        .querySelector<HTMLElement>(`#${this.fieldId(result.firstErrorField)}`)
        ?.focus();
    }
  }

  private clear(): void {
    this.form.reset({ mustChangePassword: true });
    this.errors.set({});
  }
}
