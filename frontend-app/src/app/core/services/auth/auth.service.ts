import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppUser } from '../../models/domain/app-user.model';
import { UserRole } from '../../models/enums/user-role.enum';
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
import { SessionCredentialStore } from './session-credential-store.service';
import { SessionStorageService } from './session-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userDataService = inject(UserDataService);
  private readonly sessionStorageService = inject(SessionStorageService);
  private readonly sessionCredentialStore = inject(SessionCredentialStore);
  private readonly router = inject(Router);
  private readonly mockAuthEnabled = inject(MOCK_AUTH_ENABLED);
  private readonly throttleMs = inject(SIGN_IN_THROTTLE_MS);
  private readonly currentUserSignal = signal<AppUser | null>(null);
  private consecutiveFailures = 0;
  private approvalFailures = 0;

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
    if (userId === null || user === null) return this.rejectSignIn();
    if (user.status !== UserStatus.ACTIVE) return { success: false, reason: 'disabled' };
    this.consecutiveFailures = 0;
    this.currentUserSignal.set(user);
    this.sessionStorageService.write(user.id, keepSignedIn);
    return { success: true, user };
  }

  /**
   * Checks a username and password pair without signing anyone in. It does not touch the
   * signed-in user or session storage, never keeps the password, and keeps its own
   * failure counter, which only a valid active Admin pair resets. Returns the matched user id, or null when the pair is not accepted.
   */
  async verifyCredentials(username: string, password: string): Promise<string | null> {
    if (username.trim().length === 0 || password.length === 0 || !this.isConfigured) return null;
    const userId = await this.matchCredentials(username, password);
    if (userId === null) {
      this.approvalFailures += 1;
      await this.throttleAfter(this.approvalFailures);
      return null;
    }
    const user = await firstValueFrom(this.userDataService.getById(userId));
    if (user?.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE) {
      this.approvalFailures = 0;
    }
    return userId;
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
    const sessionUserId = this.sessionCredentialStore.matchUserId(username, password);
    return tooLong ? null : (matchedUserId ?? sessionUserId);
  }

  private async rejectSignIn(): Promise<SignInResult> {
    await this.recordFailure();
    return { success: false, reason: 'invalid' };
  }

  private async recordFailure(): Promise<void> {
    this.consecutiveFailures += 1;
    await this.throttleAfter(this.consecutiveFailures);
  }

  private async throttleAfter(failures: number): Promise<void> {
    if (failures >= SIGN_IN_FAILURE_THRESHOLD) {
      await new Promise<void>(resolve => setTimeout(resolve, this.throttleMs));
    }
  }
}
