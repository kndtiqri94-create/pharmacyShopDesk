import { AppUser } from '../domain/app-user.model';

export type SignInFailureReason = 'empty' | 'invalid' | 'not-configured' | 'disabled';

export type SignInResult =
  { success: true; user: AppUser } | { success: false; reason: SignInFailureReason };
