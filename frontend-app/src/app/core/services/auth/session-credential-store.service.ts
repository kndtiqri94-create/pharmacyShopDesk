import { Injectable } from '@angular/core';
import { constantTimeEqual } from '../../utils/constant-time-equal.util';

interface SessionCredential {
  userId: string;
  password: string;
  pin: string | null;
  mustChangePassword: boolean;
}

@Injectable({ providedIn: 'root' })
export class SessionCredentialStore {
  private readonly credentials = new Map<string, SessionCredential>();

  register(username: string, credential: SessionCredential): void {
    this.credentials.set(username.trim().toLowerCase(), { ...credential });
  }

  matchUserId(username: string, password: string): string | null {
    const normalizedUsername = username.trim().toLowerCase();
    let matchedUserId: string | null = null;
    for (const [storedUsername, credential] of this.credentials) {
      const usernameMatches = constantTimeEqual(storedUsername, normalizedUsername);
      const passwordMatches = constantTimeEqual(credential.password, password);
      if (usernameMatches && passwordMatches) matchedUserId = credential.userId;
    }
    return matchedUserId;
  }
}
