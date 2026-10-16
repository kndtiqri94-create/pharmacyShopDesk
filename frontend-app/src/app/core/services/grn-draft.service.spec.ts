import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { UserRole } from '../models/enums/user-role.enum';
import { GrnFormInput } from '../utils/grn-validation.util';
import { AuthService } from './auth/auth.service';
import { GrnDraftService } from './grn-draft.service';

const entries: GrnFormInput = {
  supplierId: 'sup-001',
  purchaseOrderId: '',
  receivedDate: '2026-09-21',
  invoiceNo: 'INV-1',
  invoiceDate: '',
  paymentMethod: 'CREDIT',
  paidNow: '',
  dueDate: '',
  discount: '',
  lines: [],
};

describe('GrnDraftService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, provideRouter([{ path: 'sign-in', children: [] }])],
    });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(GrnDraftService);

  it('has nothing to restore at first', () => {
    expect(service().restore()).toBeNull();
  });

  it('gives back what was kept, as a copy', () => {
    service().keep(entries);
    const restored = service().restore();
    expect(restored).toEqual(entries);
    restored!.invoiceNo = 'changed';
    expect(service().restore()?.invoiceNo).toBe('INV-1');
  });

  it('forgets the entries once cleared', () => {
    service().keep(entries);
    service().clear();
    expect(service().restore()).toBeNull();
  });

  it('keeps entries in memory only, never in browser storage', () => {
    service().keep(entries);
    expect(localStorage.length).toBe(0);
    expect(JSON.stringify(sessionStorage)).not.toContain('INV-1');
  });

  it('forgets the entries when the person signs out', async () => {
    await signInAs(UserRole.MANAGER);
    service().keep(entries);
    TestBed.tick();
    await TestBed.inject(AuthService).signOut();
    TestBed.tick();
    expect(service().restore()).toBeNull();
  });
});
