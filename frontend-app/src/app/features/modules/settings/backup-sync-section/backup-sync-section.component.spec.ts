import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { AttentionItem } from '../../../../core/models/domain/attention-item.model';
import { SyncActionResult } from '../../../../core/models/domain/sync-action-result.model';
import { SyncStatus } from '../../../../core/models/domain/sync-status.model';
import { SyncState } from '../../../../core/models/enums/sync-state.enum';
import { SyncDataService } from '../../../../core/services/data/sync-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DATA_LOSS_NOTE } from '../../../../core/utils/sync-text.util';
import { BackupSyncSectionComponent } from './backup-sync-section.component';

describe('BackupSyncSectionComponent', () => {
  let status: BehaviorSubject<SyncStatus>;
  let attention: BehaviorSubject<readonly AttentionItem[]>;
  let syncResult: SyncActionResult;
  let backUpResult: SyncActionResult;
  const calls: string[] = [];

  const online: SyncStatus = {
    state: SyncState.ONLINE,
    pendingChanges: 0,
    attentionCount: 0,
    lastSyncAt: null,
    autoSyncEnabled: true,
  };

  beforeEach(() => {
    calls.length = 0;
    status = new BehaviorSubject<SyncStatus>(online);
    attention = new BehaviorSubject<readonly AttentionItem[]>([]);
    syncResult = { outcome: 'completed', pendingChanges: 0, attentionCount: 0 };
    backUpResult = { outcome: 'completed', pendingChanges: 0, attentionCount: 0 };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SyncDataService,
          useValue: {
            status$: status.asObservable(),
            attentionItems$: attention.asObservable(),
            syncNow: () => {
              calls.push('sync');
              return of(syncResult);
            },
            backUpNow: () => {
              calls.push('backup');
              return of(backUpResult);
            },
          },
        },
      ],
    });
  });

  afterEach(() => TestBed.inject(NotificationService).dismiss());

  function render(autoSync = true, disabled = false) {
    const fixture = TestBed.createComponent(BackupSyncSectionComponent);
    fixture.componentRef.setInput('autoSync', autoSync);
    fixture.componentRef.setInput('disabled', disabled);
    const changes: boolean[] = [];
    fixture.componentInstance.autoSyncChanged.subscribe(value => changes.push(value));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        item => item.textContent?.trim() === label
      ) as HTMLButtonElement;
    return { fixture, element, button, changes };
  }

  const message = () => TestBed.inject(NotificationService).current()?.message;

  it('shows the last sync time, the waiting count and the auto-sync switch', () => {
    status.next({ ...online, pendingChanges: 3, lastSyncAt: '2026-11-24T09:12:00.000Z' });
    const { element } = render(true);
    expect(element.textContent).toContain('Changes waiting to send');
    expect(element.querySelector('dl')?.textContent).toContain('3');
    expect(element.textContent).toContain('2026');
    const toggle = element.querySelector('[role="switch"]')!;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(element.textContent).toContain('does not need Save changes');
  });

  it('says plainly that no sync has happened yet', () => {
    const { element } = render();
    expect(element.textContent).toContain('No successful sync yet');
  });

  it('updates the waiting count as the status changes', () => {
    const { fixture, element } = render();
    status.next({ ...online, pendingChanges: 7 });
    fixture.detectChanges();
    expect(element.querySelector('dl')?.textContent).toContain('7');
  });

  it('states the data-loss limit in plain words', () => {
    const { element } = render();
    expect(element.textContent).toContain(DATA_LOSS_NOTE);
    expect(DATA_LOSS_NOTE).toContain('clear');
    expect(DATA_LOSS_NOTE).toContain('lose this device');
  });

  it('emits the new state when the switch is flipped', () => {
    const { element, changes } = render(true);
    (element.querySelector('[role="switch"]') as HTMLButtonElement).click();
    expect(changes).toEqual([false]);
  });

  it('runs Sync now and confirms when everything is up to date', async () => {
    const { button } = render();
    button('Sync now').click();
    await Promise.resolve();
    expect(calls).toEqual(['sync']);
    expect(message()).toContain('Everything is up to date');
  });

  it('tells the user it cannot sync while offline and that nothing is lost', async () => {
    syncResult = { outcome: 'offline', pendingChanges: 2, attentionCount: 0 };
    const { button } = render();
    button('Sync now').click();
    await Promise.resolve();
    expect(message()).toContain('offline');
    expect(message()).toContain('Nothing is lost');
  });

  it('says the central record holds every change after Back up now', async () => {
    const { button } = render();
    button('Back up now').click();
    await Promise.resolve();
    expect(calls).toEqual(['backup']);
    expect(message()).toContain('holds every change');
  });

  it('says what is still outstanding after Back up now', async () => {
    backUpResult = { outcome: 'completed', pendingChanges: 2, attentionCount: 0 };
    const { button } = render();
    button('Back up now').click();
    await Promise.resolve();
    expect(message()).toContain('2 changes still waiting');
  });

  it('lists each refused change with what it was, when and the reason', () => {
    attention.next([
      {
        id: 1,
        what: 'Sale',
        madeAt: '2026-11-24T08:00:00.000Z',
        reason: 'Another sale already has this invoice number.',
      },
    ]);
    status.next({ ...online, state: SyncState.NEEDS_ATTENTION, attentionCount: 1 });
    const { element } = render();
    const list = element.querySelector('app-needs-attention-list')!;
    expect(list.textContent).toContain('Sale');
    expect(list.textContent).toContain('Another sale already has this invoice number.');
    expect(list.textContent).toContain('2026');
  });

  it('shows an empty Needs attention list when nothing was refused', () => {
    const { element } = render();
    expect(element.querySelector('app-needs-attention-list')?.textContent).toContain(
      'Nothing needs attention'
    );
  });

  it('disables the switch and both buttons when disabled', () => {
    const { element, button } = render(true, true);
    expect((element.querySelector('[role="switch"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(button('Back up now').disabled).toBeTrue();
    expect(button('Sync now').disabled).toBeTrue();
  });
});
