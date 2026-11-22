import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { ThemePreference } from '../../../../core/models/enums/theme-preference.enum';
import { ClockService } from '../../../../core/services/clock.service';
import { PosFullscreenService } from '../../../../core/services/pos-fullscreen.service';
import { ThemePreferenceService } from '../../../../core/services/theme-preference.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

const CLOCK_TICK_MS = 15_000;

@Component({
  selector: 'app-pos-header',
  imports: [ButtonComponent],
  templateUrl: './pos-header.component.html',
  styleUrl: './pos-header.component.scss',
})
export class PosHeaderComponent {
  readonly refreshRequested = output<void>();
  readonly backRequested = output<void>();

  private readonly clockService = inject(ClockService);
  private readonly themePreferenceService = inject(ThemePreferenceService);
  private readonly nowSignal = signal(this.clockService.now());

  protected readonly fullscreenService = inject(PosFullscreenService);
  protected readonly isoDate = computed(() => this.nowSignal().slice(0, 10));
  protected readonly dateText = computed(() => formatDate(this.isoDate()));
  protected readonly timeText = computed(() => formatTime(this.nowSignal()));
  protected readonly isDark = computed(
    () => this.themePreferenceService.preference() === ThemePreference.DARK
  );

  constructor() {
    const timer = setInterval(() => this.nowSignal.set(this.clockService.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected toggleTheme(): void {
    this.themePreferenceService.toggle();
  }

  protected toggleFullscreen(): void {
    this.fullscreenService.toggle().catch(() => undefined);
  }
}
