import { TestBed } from '@angular/core/testing';
import { SessionCredentialStore } from './session-credential-store.service';

describe('SessionCredentialStore', () => {
  const store = () => TestBed.inject(SessionCredentialStore);
  const credential = {
    userId: 'usr-005',
    password: 'Welcome-1',
    pin: '1234',
    mustChangePassword: true,
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('matches a registered username and password, ignoring case and spaces in the username', () => {
    store().register('Suresh', credential);
    expect(store().matchUserId(' SURESH ', 'Welcome-1')).toBe('usr-005');
  });

  it('does not match a wrong password, another user or an empty store', () => {
    expect(store().matchUserId('suresh', 'Welcome-1')).toBeNull();
    store().register('suresh', credential);
    expect(store().matchUserId('suresh', 'welcome-1')).toBeNull();
    expect(store().matchUserId('other', 'Welcome-1')).toBeNull();
  });

  it('keeps its own copy, so changing the object passed in changes nothing', () => {
    const mutable = { ...credential };
    store().register('suresh', mutable);
    mutable.password = 'changed-123';
    expect(store().matchUserId('suresh', 'Welcome-1')).toBe('usr-005');
  });

  it('offers no way to read a password or PIN back', () => {
    store().register('suresh', credential);
    const publicMembers = Object.getOwnPropertyNames(Object.getPrototypeOf(store()));
    expect(publicMembers.sort()).toEqual(['constructor', 'matchUserId', 'register']);
  });

  it('never writes anything to browser storage', () => {
    store().register('suresh', credential);
    store().matchUserId('suresh', 'Welcome-1');
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain('Welcome-1');
    expect(sessionStorage.length + localStorage.length).toBe(0);
  });
});
