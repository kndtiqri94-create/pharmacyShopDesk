import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../../core/services/notification.service';
import { BACKUP_NOTICE, BackupSyncSectionComponent } from './backup-sync-section.component';

describe('BackupSyncSectionComponent', () => {
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

  afterEach(() => TestBed.inject(NotificationService).dismiss());

  it('shows the backup notice and the auto-sync switch in the given state', () => {
    const { element } = render(true);
    expect(element.querySelector('app-alert')?.textContent).toContain(BACKUP_NOTICE);
    const toggle = element.querySelector('[role="switch"]')!;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent).toContain('Sync automatically when online');
    expect(element.textContent).toContain('does not need Save changes');
  });

  it('emits the new state when the switch is flipped', () => {
    const { element, changes } = render(true);
    (element.querySelector('[role="switch"]') as HTMLButtonElement).click();
    expect(changes).toEqual([false]);
  });

  it('answers Back up now and Sync now with sample-only messages', () => {
    const { button } = render();
    button('Back up now').click();
    expect(TestBed.inject(NotificationService).current()?.message).toBe(
      'Back up now is sample only for now and does nothing yet.'
    );
    button('Sync now').click();
    expect(TestBed.inject(NotificationService).current()?.message).toBe(
      'Sync now is sample only for now and does nothing yet.'
    );
  });

  it('disables the switch and both buttons when disabled', () => {
    const { element, button } = render(true, true);
    expect((element.querySelector('[role="switch"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(button('Back up now').disabled).toBeTrue();
    expect(button('Sync now').disabled).toBeTrue();
  });
});
