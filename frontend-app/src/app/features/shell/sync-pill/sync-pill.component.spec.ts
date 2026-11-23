import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { SyncStatus } from '../../../core/models/domain/sync-status.model';
import { SyncState } from '../../../core/models/enums/sync-state.enum';
import { SyncDataService } from '../../../core/services/data/sync-data.service';
import { SyncPillComponent } from './sync-pill.component';

describe('SyncPillComponent', () => {
  let statusSubject: BehaviorSubject<SyncStatus>;

  beforeEach(() => {
    statusSubject = new BehaviorSubject<SyncStatus>({
      state: SyncState.ONLINE,
      pendingChanges: 0,
      attentionCount: 0,
      lastSyncAt: null,
      autoSyncEnabled: true,
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SyncDataService,
          useValue: { status$: statusSubject.asObservable(), attentionItems$: of([]) },
        },
      ],
    });
  });

  function render(status: Partial<SyncStatus>) {
    statusSubject.next({ ...statusSubject.value, ...status });
    const fixture = TestBed.createComponent(SyncPillComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, output: element.querySelector('output')! };
  }

  it('shows Online with nothing waiting', () => {
    const { output } = render({ state: SyncState.ONLINE, pendingChanges: 0 });
    expect(output.textContent).toContain('Online');
    expect(output.textContent).not.toContain('waiting');
    expect(output.getAttribute('data-state')).toBe('ONLINE');
  });

  it('shows Syncing with the count still to send', () => {
    const { output } = render({ state: SyncState.SYNCING, pendingChanges: 4 });
    expect(output.textContent).toContain('Syncing... 4 left');
    expect(output.getAttribute('data-state')).toBe('SYNCING');
  });

  it('shows Offline with the number of changes waiting', () => {
    const { output } = render({ state: SyncState.OFFLINE, pendingChanges: 3 });
    expect(output.textContent).toContain('Offline - 3 changes waiting');
  });

  it('shows Needs attention with the number of refused changes', () => {
    const { output } = render({ state: SyncState.NEEDS_ATTENTION, attentionCount: 2 });
    expect(output.textContent).toContain('Needs attention - 2');
    expect(output.getAttribute('data-tone')).toBe('danger');
  });

  it('never claims everything is saved while changes are waiting online', () => {
    const { output } = render({ state: SyncState.ONLINE, pendingChanges: 2 });
    expect(output.textContent).toContain('Online - 2 waiting to send');
  });

  it('shows exactly one state at a time and never blocks the screen', () => {
    const { element } = render({ state: SyncState.OFFLINE, pendingChanges: 2 });
    expect(element.querySelectorAll('output')).toHaveSize(1);
    expect(element.querySelector('button')).toBeNull();
  });

  it('follows the live status without any test action', () => {
    const { fixture, output } = render({ state: SyncState.ONLINE, pendingChanges: 0 });
    statusSubject.next({ ...statusSubject.value, state: SyncState.OFFLINE, pendingChanges: 1 });
    fixture.detectChanges();
    expect(output.textContent).toContain('Offline - 1 change waiting');
  });
});
