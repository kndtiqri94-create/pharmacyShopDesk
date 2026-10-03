import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../core/services/notification.service';
import { ModulePlaceholderComponent } from './module-placeholder.component';

describe('ModulePlaceholderComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { module: ModuleKey.PRODUCTS } } },
        },
      ],
    });
  });

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(role: UserRole) {
    await signInAs(role);
    const fixture = TestBed.createComponent(ModulePlaceholderComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the module heading, a one-sentence subtitle and a coming-soon message', async () => {
    const element = await render(UserRole.PHARMACIST);
    expect(element.querySelector('h1')?.textContent).toBe('Products');
    expect(element.textContent).toContain(
      'Everything you sell, with stock, batches and expiry dates.'
    );
    expect(element.textContent).toContain('coming soon');
  });

  it('offers a write action to a role with Full access', async () => {
    const element = await render(UserRole.PHARMACIST);
    expect(element.textContent).toContain('Create sample record');
    expect(element.textContent).not.toContain('View only');
  });

  it('hides write actions and says so for a View-only role', async () => {
    const element = await render(UserRole.CASHIER);
    expect(element.textContent).not.toContain('Create sample record');
    expect(element.textContent).toContain('View only');
    expect(element.textContent).toContain('you cannot change anything');
  });

  it('gives a sample-only message from the write action', async () => {
    const element = await render(UserRole.PHARMACIST);
    const button = Array.from(element.querySelectorAll('button')).find(candidate =>
      candidate.textContent?.includes('Create sample record')
    ) as HTMLButtonElement;
    button.click();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('sample only');
  });
});
