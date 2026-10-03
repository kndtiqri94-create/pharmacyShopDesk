import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { AccessDeniedComponent } from '../access-denied/access-denied.component';
import { NotFoundComponent } from '../not-found/not-found.component';

describe('error pages', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
  });

  afterEach(clearBrowserStorage);

  it('access denied explains the problem and links back to a usable module', async () => {
    await signInAs(UserRole.CASHIER);
    const fixture = TestBed.createComponent(AccessDeniedComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Access denied');
    expect(element.textContent).toContain("You don't have access to this area");
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    (element.querySelector('button') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith('/products');
  });

  it('page not found offers a way back to the first module the role allows', async () => {
    await signInAs(UserRole.ADMIN);
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Page not found');
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    (element.querySelector('button') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('offers no button when the role has no module to go to', () => {
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it('uses plain words without exclamation marks', () => {
    const fixture = TestBed.createComponent(AccessDeniedComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('!');
  });
});
