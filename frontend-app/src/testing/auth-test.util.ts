import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserRole } from '../app/core/models/enums/user-role.enum';
import { AuthService } from '../app/core/services/auth/auth.service';
import { MOCK_AUTH_ENABLED, SIGN_IN_THROTTLE_MS } from '../app/core/services/auth/auth.tokens';
import { MOCK_CREDENTIALS } from '../app/core/services/auth/mock-credentials';
import { provideDataServices } from '../app/core/services/data/data-providers';
import { USER_SEED } from '../app/core/services/data/in-memory/seed/user.seed';

export const TEST_PROVIDERS: Provider[] = [
  provideDataServices(true),
  { provide: SIGN_IN_THROTTLE_MS, useValue: 0 },
  { provide: MOCK_AUTH_ENABLED, useValue: true },
];

export function clearBrowserStorage(): void {
  sessionStorage.clear();
  localStorage.clear();
}

export async function signInAs(role: UserRole): Promise<void> {
  const user = USER_SEED.find(candidate => candidate.role === role);
  const credential = MOCK_CREDENTIALS.find(candidate => candidate.userId === user?.id);
  if (!credential) throw new Error(`No sample credential for ${role}`);
  const result = await TestBed.inject(AuthService).signIn(
    credential.username,
    credential.password,
    false
  );
  if (!result.success) throw new Error(`Sample sign-in failed for ${role}`);
}
