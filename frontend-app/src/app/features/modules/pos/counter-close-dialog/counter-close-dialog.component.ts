import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CounterReport } from '../../../../core/models/domain/counter-report.model';
import { IconName } from '../../../../core/models/shared/icon-name.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { CounterPreview, PosCounterService } from '../../../../core/services/pos-counter.service';
import { formatDate, formatTime } from '../../../../core/utils/date.util';
import { formatRupeesExact, formatRupeesInput } from '../../../../core/utils/money.util';
import {
  COUNTER_NOTE_MAX_LENGTH,
  COUNTER_OUTCOME_LABELS,
  CounterCloseField,
  CounterOutcome,
  canComplete,
  counterDifferenceCents,
  counterOutcome,
  isSupervisorRequired,
  parseCountedCents,
  unaccountedCents,
  validateBroughtForward,
  validateCounterClose,
  validateHandover,
} from '../../../../core/utils/pos-counter.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { DenominationDialogComponent } from '../denomination-dialog/denomination-dialog.component';
import { PosDialogComponent } from '../pos-dialog/pos-dialog.component';
import { COUNTER_CLOSE_LABELS, bilingualText } from './counter-close-labels';

const COMPLETE_HINT_ID = 'counter-complete-hint';
const NO_ACTIVITY_TEXT = 'No activity yet';
const END_PENDING_TEXT = 'Set when you complete the close';
const AMOUNT_MAX_LENGTH = 12;

const OUTCOME_ICONS: Record<CounterOutcome, IconName> = {
  OVER: 'trend',
  SHORT: 'alert',
  BALANCED: 'check',
};

interface CounterCloseView {
  locked: boolean;
  cashier: string;
  register: string;
  startTime: string | null;
  endTime: string | null;
  totalSalesCents: number;
  openingCents: number;
  cashInCents: number;
  cashOutCents: number;
  expectedCents: number;
  countedCents: number | null;
  differenceCents: number | null;
  handoverCents: number | null;
  supervisorName: string | null;
  broughtForwardCents: number | null;
  unaccountedCents: number | null;
  note: string;
}

@Component({
  selector: 'app-counter-close-dialog',
  imports: [
    AlertComponent,
    ButtonComponent,
    DenominationDialogComponent,
    IconComponent,
    PosDialogComponent,
    ...FIELD_IMPORTS,
  ],
  templateUrl: './counter-close-dialog.component.html',
  styleUrl: './counter-close-dialog.component.scss',
})
export class CounterCloseDialogComponent {
  readonly open = input(false);
  readonly canChange = input(true);
  readonly hasUnsavedBill = input(false);
  readonly closed = output<void>();
  readonly printRequested = output<CounterReport>();

  private readonly counterService = inject(PosCounterService);
  private readonly notificationService = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly calculator = viewChild('calculator', { read: ElementRef<HTMLElement> });

  protected readonly preview = signal<CounterPreview | null>(null);
  protected readonly countedText = signal('');
  protected readonly handoverText = signal('');
  protected readonly supervisorUserId = signal('');
  protected readonly broughtForwardText = signal<string | null>(null);
  protected readonly note = signal('');
  protected readonly attempted = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly denominationsOpen = signal(false);

  protected readonly labels = COUNTER_CLOSE_LABELS;
  protected readonly bilingual = bilingualText;
  protected readonly money = formatRupeesExact;
  protected readonly dateOf = formatDate;
  protected readonly timeOf = formatTime;
  protected readonly outcomeLabels = COUNTER_OUTCOME_LABELS;
  protected readonly outcomeIcons = OUTCOME_ICONS;
  protected readonly noteMaxLength = COUNTER_NOTE_MAX_LENGTH;
  protected readonly amountMaxLength = AMOUNT_MAX_LENGTH;
  protected readonly completeHintId = COMPLETE_HINT_ID;
  protected readonly noActivityText = NO_ACTIVITY_TEXT;
  protected readonly endPendingText = END_PENDING_TEXT;

  protected readonly completeEnabled = computed(() => canComplete(this.countedText()));
  protected readonly validation = computed(() =>
    validateCounterClose({
      countedText: this.countedText(),
      handoverText: this.handoverText(),
      supervisorUserId: this.supervisorUserId() || null,
      broughtForwardText: this.broughtForwardText(),
    })
  );
  protected readonly amounts = computed(() => {
    const counted = parseCountedCents(this.countedText());
    if (!counted.ok) return null;
    const handover = validateHandover(counted.cents, this.handoverText());
    if (!handover.ok) return null;
    const broughtForward = validateBroughtForward(
      counted.cents,
      handover.cents,
      this.broughtForwardText()
    );
    if (!broughtForward.ok)
      return { handoverCents: handover.cents, unaccountedCents: null, broughtForwardCents: null };
    return {
      handoverCents: handover.cents,
      broughtForwardCents: broughtForward.cents,
      unaccountedCents: unaccountedCents(counted.cents, handover.cents, broughtForward.cents),
    };
  });
  protected readonly supervisorNeeded = computed(() =>
    isSupervisorRequired(this.amounts()?.handoverCents ?? 0)
  );
  protected readonly broughtForwardDisplay = computed(() => {
    const typed = this.broughtForwardText();
    if (typed !== null) return typed;
    const cents = this.amounts()?.broughtForwardCents ?? null;
    return cents === null ? '' : formatRupeesInput(cents);
  });
  protected readonly errors = computed<Partial<Record<CounterCloseField, string>>>(() => {
    const result = this.validation();
    if (result.ok || !this.isVisibleError(result.field)) return {};
    return { [result.field]: result.message };
  });
  protected readonly view = computed<CounterCloseView | null>(() => {
    const current = this.preview();
    if (current === null) return null;
    return current.report === null ? this.liveView(current) : this.lockedView(current.report);
  });
  protected readonly outcome = computed(() => {
    const difference = this.view()?.differenceCents ?? null;
    return difference === null ? null : counterOutcome(difference);
  });

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.load());
    });
  }

  protected onCountedInput(event: Event): void {
    this.countedText.set(this.valueOf(event));
    this.formError.set(null);
  }

  protected onHandoverInput(event: Event): void {
    this.handoverText.set(this.valueOf(event));
    this.formError.set(null);
  }

  protected onSupervisorChange(event: Event): void {
    this.supervisorUserId.set(this.valueOf(event));
    this.formError.set(null);
  }

  protected onBroughtForwardInput(event: Event): void {
    this.broughtForwardText.set(this.valueOf(event));
    this.formError.set(null);
  }

  protected onNoteInput(event: Event): void {
    this.note.set(this.valueOf(event));
  }

  protected openDenominations(): void {
    this.denominationsOpen.set(true);
  }

  protected closeDenominations(): void {
    this.denominationsOpen.set(false);
    afterNextRender(() => this.calculator()?.nativeElement.querySelector('button')?.focus(), {
      injector: this.injector,
    });
  }

  protected useDenominationTotal(totalCents: number): void {
    this.countedText.set(formatRupeesInput(totalCents));
    this.formError.set(null);
    this.closeDenominations();
  }

  protected ask(): void {
    if (!this.completeEnabled()) return;
    this.attempted.set(true);
    if (!this.validation().ok) return;
    this.confirming.set(true);
  }

  protected keep(): void {
    this.confirming.set(false);
  }

  protected confirmClose(): void {
    this.closeCounter().catch(() => undefined);
  }

  protected fieldError(field: CounterCloseField): string | null {
    return this.errors()[field] ?? null;
  }

  private isVisibleError(field: CounterCloseField): boolean {
    if (field === 'counted') return this.countedText().trim().length > 0;
    if (field === 'supervisor') return this.attempted();
    return true;
  }

  private valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private liveView(current: CounterPreview): CounterCloseView {
    const counted = parseCountedCents(this.countedText());
    const countedCents = counted.ok ? counted.cents : null;
    return {
      locked: false,
      cashier: current.cashierName,
      register: current.register,
      startTime: current.startTime,
      endTime: null,
      totalSalesCents: current.totalSalesCents,
      openingCents: current.openingCents,
      cashInCents: current.cashInCents,
      cashOutCents: current.cashOutCents,
      expectedCents: current.expectedCents,
      countedCents,
      differenceCents:
        countedCents === null ? null : counterDifferenceCents(countedCents, current.expectedCents),
      handoverCents: null,
      supervisorName: null,
      broughtForwardCents: null,
      unaccountedCents: this.amounts()?.unaccountedCents ?? null,
      note: this.note(),
    };
  }

  private lockedView(report: CounterReport): CounterCloseView {
    return {
      locked: true,
      cashier: report.closedBy,
      register: report.register,
      startTime: report.startTime,
      endTime: report.endTime,
      totalSalesCents: report.totalSalesCents,
      openingCents: report.openingCents,
      cashInCents: report.cashInCents,
      cashOutCents: report.cashOutCents,
      expectedCents: report.expectedCents,
      countedCents: report.countedCents,
      differenceCents: report.differenceCents,
      handoverCents: report.handoverCents,
      supervisorName: report.supervisorName,
      broughtForwardCents: report.broughtForwardCents,
      unaccountedCents: report.unaccountedCents,
      note: report.note,
    };
  }

  private load(): void {
    this.confirming.set(false);
    this.attempted.set(false);
    this.formError.set(null);
    this.denominationsOpen.set(false);
    this.countedText.set('');
    this.handoverText.set('');
    this.supervisorUserId.set('');
    this.broughtForwardText.set(null);
    this.note.set('');
    this.counterService
      .preview()
      .then(preview => this.preview.set(preview))
      .catch(() => undefined);
  }

  private async closeCounter(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.counterService.close({
        countedText: this.countedText(),
        handoverText: this.handoverText(),
        supervisorUserId: this.supervisorUserId() || null,
        broughtForwardText: this.broughtForwardText(),
        note: this.note(),
        confirmed: true,
      });
      this.confirming.set(false);
      if (!result.ok) {
        this.formError.set(result.message);
        return;
      }
      this.notificationService.show('success', 'The counter is closed and the report is locked.');
      this.preview.set(await this.counterService.preview());
    } finally {
      this.busy.set(false);
    }
  }
}
