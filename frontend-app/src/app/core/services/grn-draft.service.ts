import { Injectable, effect, inject } from '@angular/core';
import { cloneValue } from '../utils/clone.util';
import { GrnFormInput } from '../utils/grn-validation.util';
import { AuthService } from './auth/auth.service';

@Injectable({ providedIn: 'root' })
export class GrnDraftService {
  private readonly authService = inject(AuthService);
  private draft: GrnFormInput | null = null;

  constructor() {
    effect(() => {
      if (this.authService.currentUser() === null) this.clear();
    });
  }

  restore(): GrnFormInput | null {
    return this.draft === null ? null : cloneValue(this.draft);
  }

  keep(input: GrnFormInput): void {
    this.draft = cloneValue(input);
  }

  clear(): void {
    this.draft = null;
  }
}
