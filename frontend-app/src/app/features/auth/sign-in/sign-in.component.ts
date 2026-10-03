import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SIGN_IN_MAX_INPUT_LENGTH } from '../../../core/services/auth/auth.tokens';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../shared/components/field/field.imports';
import { IconComponent } from '../../../shared/components/icon/icon.component';

export const SIGN_IN_FAILED_MESSAGE = 'Check your password and try again.';
export const USERNAME_REQUIRED_MESSAGE = 'Enter your username or email.';
export const PASSWORD_REQUIRED_MESSAGE = 'Enter your password.';

@Component({
  selector: 'app-sign-in',
  imports: [ReactiveFormsModule, AlertComponent, ButtonComponent, IconComponent, ...FIELD_IMPORTS],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
})
export class SignInComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  protected readonly authService = inject(AuthService);
  protected readonly maxLength = SIGN_IN_MAX_INPUT_LENGTH;
  protected readonly form = this.formBuilder.group({
    username: this.formBuilder.control('', [Validators.maxLength(SIGN_IN_MAX_INPUT_LENGTH)]),
    password: this.formBuilder.control('', [Validators.maxLength(SIGN_IN_MAX_INPUT_LENGTH)]),
    keepSignedIn: this.formBuilder.control(false),
  });
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);

  private readonly submitted = signal(false);
  private readonly signInFailed = signal(false);
  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly usernameError = computed(() =>
    this.submitted() && !this.values().username?.trim() ? USERNAME_REQUIRED_MESSAGE : null
  );
  protected readonly passwordError = computed(() => {
    if (this.submitted() && !this.values().password) return PASSWORD_REQUIRED_MESSAGE;
    return this.signInFailed() ? SIGN_IN_FAILED_MESSAGE : null;
  });

  constructor() {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.signInFailed.set(false));
  }

  protected submit(): void {
    this.performSignIn().catch(() => undefined);
  }

  protected toggleReveal(): void {
    this.showPassword.update(visible => !visible);
  }

  protected showSampleMessage(feature: string): void {
    this.notificationService.showSampleOnly(feature);
  }

  private async performSignIn(): Promise<void> {
    this.submitted.set(true);
    const { username, password, keepSignedIn } = this.form.getRawValue();
    if (!username.trim() || !password || this.submitting()) return;
    this.submitting.set(true);
    const result = await this.authService.signIn(username, password, keepSignedIn);
    this.submitting.set(false);
    if (result.success) {
      const returnUrl = this.activatedRoute.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(this.permissionService.landingPathFor(returnUrl));
      return;
    }
    this.form.controls.password.reset('');
    this.signInFailed.set(true);
  }
}
