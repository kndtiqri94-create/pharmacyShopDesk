import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { ModuleKey } from '../models/enums/module-key.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { RoleDataService } from '../services/data/role-data.service';
import { CanWriteDirective } from './permission-write.directive';

@Component({
  imports: [CanWriteDirective],
  template: `<button *appCanWrite="module">Create product</button>`,
})
class HostComponent {
  protected readonly module = ModuleKey.PRODUCTS;
}

describe('CanWriteDirective', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  async function render(role: UserRole) {
    await signInAs(role);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the action to a role with Full access', async () => {
    const fixture = await render(UserRole.PHARMACIST);
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
  });

  it('hides the action from a role with View access', async () => {
    const fixture = await render(UserRole.CASHIER);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('follows matrix changes without signing in again', async () => {
    const fixture = await render(UserRole.CASHIER);
    const roleDataService = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleDataService.getMatrix());
    await firstValueFrom(
      roleDataService.saveMatrix({
        ...matrix,
        CASHIER: { ...matrix.CASHIER, [ModuleKey.PRODUCTS]: 'FULL' },
      })
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
  });
});
