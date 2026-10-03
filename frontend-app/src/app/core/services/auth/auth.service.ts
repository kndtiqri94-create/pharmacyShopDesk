import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../../models/domain/app-user.model';
import { UserStatus } from '../../models/enums/user-status.enum';
import { SignInResult } from '../../models/shared/sign-in-result.model';
import { constantTimeEqual } from '../../utils/constant-time-equal.util';
import { UserDataService } from '../data/user-data.service';
import {
  MOCK_AUTH_ENABLED,
  SIGN_IN_FAILURE_THRESHOLD,
  SIGN_IN_MAX_INPUT_LENGTH,
  SIGN_IN_THROTTLE_MS,
} from './auth.tokens';
import { SessionStorageService } from './session-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userDataService = inject(UserDataService);
  private readonly sessionStorageService = inject(SessionStorageService);
  private readonly router = inject(Router);
  private readonly mockAuthEnabled = inject(MOCK_AUTH_ENABLED);
  private readonly throttleMs = inject(SIGN_IN_THROTTLE_MS);
  private readonly currentUserSignal = signal<AppUser | null>(null);
  private consecutiveFailures = 0;

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isSignedIn = computed(() => this.currentUserSignal() !== null);
  readonly isConfigured = this.mockAuthEnabled;

  async restoreSession(): Promise<void> {
    if (!this.isConfigured) {
      this.sessionStorageService.clear();
      return;
    }
    const userId = this.sessionStorageService.read();
    if (userId === null) return;
    const user = await firstValueFrom(this.userDataService.getById(userId));
    if (user?.status === UserStatus.ACTIVE) {
      this.currentUserSignal.set(user);
      return;
    }
    this.sessionStorageService.clear();
  }

  async signIn(username: string, password: string, keepSignedIn: boolean): Promise<SignInResult> {
    if (username.trim().length === 0 || password.length === 0) {
      return { success: false, reason: 'empty' };
    }
    if (!this.isConfigured) {
      return { success: false, reason: 'not-configured' };
    }
    const userId = await this.matchCredentials(username, password);
    const user = await firstValueFrom(this.userDataService.getById(userId ?? ''));
    if (userId === null || user?.status !== UserStatus.ACTIVE) {
      return this.rejectSignIn();
    }
    this.consecutiveFailures = 0;
    this.currentUserSignal.set(user);
    this.sessionStorageService.write(user.id, keepSignedIn);
    return { success: true, user };
  }

  async signOut(): Promise<void> {
    this.currentUserSignal.set(null);
    this.sessionStorageService.clear();
    await this.router.navigate(['/sign-in'], { replaceUrl: true });
  }

  private async matchCredentials(username: string, password: string): Promise<string | null> {
    const { MOCK_CREDENTIALS } = await import('./mock-credentials');
    const tooLong =
      username.length > SIGN_IN_MAX_INPUT_LENGTH || password.length > SIGN_IN_MAX_INPUT_LENGTH;
    const normalizedUsername = username.trim().toLowerCase();
    let matchedUserId: string | null = null;
    for (const credential of MOCK_CREDENTIALS) {
      const usernameMatches = constantTimeEqual(credential.username, normalizedUsername);
      const passwordMatches = constantTimeEqual(credential.password, password);
      if (usernameMatches && passwordMatches && !tooLong) matchedUserId = credential.userId;
    }
    return matchedUserId;
  }

  private async rejectSignIn(): Promise<SignInResult> {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= SIGN_IN_FAILURE_THRESHOLD) {
      await new Promise<void>(resolve => setTimeout(resolve, this.throttleMs));
    }
    return { success: false, reason: 'invalid' };
  }
}
