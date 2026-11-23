import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  STORAGE_MANAGER,
  StorageManagerLike,
  StoragePersistenceService,
} from '../../../core/services/data/local/storage-persistence.service';
import { StorageWarningComponent } from './storage-warning.component';

describe('StorageWarningComponent', () => {
  let fixture: ComponentFixture<StorageWarningComponent>;

  async function render(manager: StorageManagerLike | null, requestFirst = true): Promise<void> {
    TestBed.configureTestingModule({
      imports: [StorageWarningComponent],
      providers: [{ provide: STORAGE_MANAGER, useValue: manager }],
    });
    if (requestFirst) await TestBed.inject(StoragePersistenceService).request();
    fixture = TestBed.createComponent(StorageWarningComponent);
    fixture.detectChanges();
  }

  const alert = () => fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;

  it('shows the warning when the browser refuses persistent storage', async () => {
    await render({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
    });
    expect(alert()).not.toBeNull();
    expect(alert()!.textContent).toContain('Your saved data may be cleared');
  });

  it('shows the warning when the browser cannot offer persistent storage at all', async () => {
    await render(null);
    expect(alert()!.textContent).toContain('Your saved data may be cleared');
  });

  it('hides the warning when the browser grants persistent storage', async () => {
    await render({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(true) });
    expect(alert()).toBeNull();
  });

  it('hides the warning while the answer is not known yet', async () => {
    await render({ persist: () => Promise.resolve(false) }, false);
    expect(alert()).toBeNull();
  });
});
