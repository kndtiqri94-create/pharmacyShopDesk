import { TestBed } from '@angular/core/testing';
import { clearBrowserStorage } from '../../../../testing/auth-test.util';
import { SESSION_STORAGE_KEY, SessionStorageService } from './session-storage.service';

describe('SessionStorageService', () => {
  let service: SessionStorageService;

  beforeEach(() => {
    clearBrowserStorage();
    service = TestBed.inject(SessionStorageService);
  });

  afterEach(clearBrowserStorage);

  it('stores the user id in session storage by default', () => {
    service.write('usr-001', false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('usr-001');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(service.read()).toBe('usr-001');
  });

  it('stores the user id in local storage only when asked to keep the user signed in', () => {
    service.write('usr-002', true);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe('usr-002');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(service.read()).toBe('usr-002');
  });

  it('keeps only one copy when the choice changes', () => {
    service.write('usr-002', true);
    service.write('usr-002', false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('ignores tampered values that are not a plain user id', () => {
    for (const value of ['{"role":"ADMIN"}', '<script>', 'USR-001', '', 'a'.repeat(65)]) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, value);
      expect(service.read()).withContext(value).toBeNull();
    }
  });

  it('clears both stores', () => {
    service.write('usr-001', true);
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'usr-001');
    service.clear();
    expect(service.read()).toBeNull();
  });
});
