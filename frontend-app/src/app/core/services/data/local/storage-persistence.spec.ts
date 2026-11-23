import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  GRANTING_STORAGE,
  REFUSING_STORAGE,
  createLocalTestEnvironment,
} from '../../../../../testing/local-data-test.util';
import { StorageWarningComponent } from '../../../../features/shell/storage-warning/storage-warning.component';
import { ProductDataService } from '../product-data.service';
import { LocalDbEvents } from './local-db-events.service';
import { STORAGE_MANAGER, StoragePersistenceService } from './storage-persistence.service';

function warningText(): string {
  const fixture = TestBed.createComponent(StorageWarningComponent);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('storage persistence', () => {
  it('shows no warning when the browser agrees to keep the data', async () => {
    TestBed.configureTestingModule({
      providers: createLocalTestEnvironment().providers(GRANTING_STORAGE),
    });
    const service = TestBed.inject(StoragePersistenceService);
    expect(await service.request()).toBeTrue();
    expect(service.showWarning()).toBeFalse();
    expect(warningText().trim()).toBe('');
  });

  it('shows a clear warning when the browser refuses to keep the data', async () => {
    TestBed.configureTestingModule({
      providers: createLocalTestEnvironment().providers(REFUSING_STORAGE),
    });
    const service = TestBed.inject(StoragePersistenceService);
    expect(await service.request()).toBeFalse();
    expect(service.showWarning()).toBeTrue();
    expect(warningText()).toContain('may be cleared');
    expect(TestBed.inject(LocalDbEvents).list()).toContain({
      code: 'storage.persist.denied',
      detail: null,
    });
  });

  it('treats a browser without the storage request as a refusal', async () => {
    TestBed.configureTestingModule({
      providers: [
        ...createLocalTestEnvironment().providers(),
        { provide: STORAGE_MANAGER, useValue: null },
      ],
    });
    const service = TestBed.inject(StoragePersistenceService);
    expect(await service.request()).toBeFalse();
    expect(service.showWarning()).toBeTrue();
  });

  it('treats a failing storage request as a refusal', async () => {
    TestBed.configureTestingModule({
      providers: [
        ...createLocalTestEnvironment().providers(),
        { provide: STORAGE_MANAGER, useValue: { persist: () => Promise.reject(new Error('no')) } },
      ],
    });
    expect(await TestBed.inject(StoragePersistenceService).request()).toBeFalse();
  });

  it('asks the browser once the local data opens, and shows no warning before it answers', async () => {
    TestBed.configureTestingModule({
      providers: createLocalTestEnvironment().providers(REFUSING_STORAGE),
    });
    const service = TestBed.inject(StoragePersistenceService);
    expect(service.persisted()).toBeNull();
    expect(service.showWarning()).toBeFalse();
    await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    await new Promise(resolve => setTimeout(resolve));
    expect(service.persisted()).toBeFalse();
    expect(service.showWarning()).toBeTrue();
  });
});
