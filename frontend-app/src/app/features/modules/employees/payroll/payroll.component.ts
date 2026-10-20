import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PermissionService } from '../../../../core/services/permission.service';
import { Subscription } from 'rxjs';
import { ClockService } from '../../../../core/services/clock.service';
import { PayrollExportService } from '../../../../core/services/payroll-export.service';
import { PayrollRow, PayrollService } from '../../../../core/services/payroll.service';
import {
  PayrollFilters,
  PayrollTab,
  defaultPayrollFilters,
  parsePayrollTab,
  payrollMonthKey,
  payrollMonthLabel,
  payrollYearChoices,
} from '../../../../core/utils/payroll-list.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { BreadcrumbItem } from '../../../../shared/components/breadcrumb/breadcrumb-item.model';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TabItem } from '../../../../shared/components/tabs/tab-item.model';
import { TabsComponent } from '../../../../shared/components/tabs/tabs.component';
import { PayrollFiltersComponent } from './payroll-filters/payroll-filters.component';
import { NopayDialogComponent } from './nopay-dialog/nopay-dialog.component';
import {
  PayrollRecordsDialogComponent,
  PayrollRecordsKind,
} from './payroll-records-dialog/payroll-records-dialog.component';
import { PayrollRowAction } from './payroll-row-menu/payroll-row-menu.component';
import {
  PayrollRecordsEvent,
  PayrollRowActionEvent,
  PayrollTableComponent,
} from './payroll-table/payroll-table.component';
import { QuickLeaveDialogComponent } from './quick-leave-dialog/quick-leave-dialog.component';
import { SalaryAdvanceDialogComponent } from './salary-advance-dialog/salary-advance-dialog.component';

interface OpenAction {
  row: PayrollRow;
  action: PayrollRowAction;
}

interface OpenRecords {
  row: PayrollRow;
  kind: PayrollRecordsKind;
}

const TAB_PANEL_ID = 'payroll-tab-panel';

@Component({
  selector: 'app-payroll',
  imports: [
    AlertComponent,
    BreadcrumbComponent,
    ButtonComponent,
    CardComponent,
    NopayDialogComponent,
    PageHeaderComponent,
    PayrollFiltersComponent,
    PayrollRecordsDialogComponent,
    PayrollTableComponent,
    QuickLeaveDialogComponent,
    SalaryAdvanceDialogComponent,
    TabsComponent,
  ],
  templateUrl: './payroll.component.html',
  styleUrl: './payroll.component.scss',
})
export class PayrollComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly clockService = inject(ClockService);
  private readonly payrollService = inject(PayrollService);
  private readonly exportService = inject(PayrollExportService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly panelId = TAB_PANEL_ID;
  protected readonly breadcrumb: readonly BreadcrumbItem[] = [
    { label: 'Employees', link: '/employees' },
    { label: 'Employees salaries' },
  ];
  protected readonly tabItems: readonly TabItem[] = [
    { id: 'monthly', label: 'Monthly Pay' },
    { id: 'daily', label: 'Daily Pay' },
  ];

  protected readonly defaults = computed(() => defaultPayrollFilters(this.clockService.today()));
  protected readonly years = computed(() => payrollYearChoices(this.clockService.today()));
  protected readonly tab = signal<PayrollTab>('monthly');
  protected readonly applied = signal<PayrollFilters>(
    defaultPayrollFilters(this.clockService.today())
  );
  protected readonly rows = signal<readonly PayrollRow[]>([]);
  protected readonly locations = signal<readonly string[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly canWrite = computed(() => this.permissionService.canWrite(ModuleKey.PAYROLL));
  protected readonly exporting = signal(false);
  protected readonly openAction = signal<OpenAction | null>(null);
  protected readonly openRecords = signal<OpenRecords | null>(null);
  protected readonly month = computed(() => payrollMonthKey(this.applied()));
  protected readonly subtitle = computed(
    () => `${payrollMonthLabel(this.applied().month)} ${this.applied().year}`
  );

  private readonly filters = viewChild(PayrollFiltersComponent);
  private pending: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.pending?.unsubscribe());
  }

  ngOnInit(): void {
    this.payrollService
      .getLocations()
      .subscribe({ next: names => this.locations.set(names), error: () => undefined });
    this.load();
  }

  protected setTab(value: string): void {
    const next = parsePayrollTab(value);
    if (next === this.tab()) return;
    this.tab.set(next);
    this.load();
  }

  protected applyFilters(filters: PayrollFilters): void {
    this.applied.set(filters);
    this.load();
  }

  protected resetFilters(): void {
    this.filters()?.reset();
  }

  protected startAction(event: PayrollRowActionEvent): void {
    if (this.canWrite()) this.openAction.set(event);
  }

  protected showRecords(event: PayrollRecordsEvent): void {
    this.openRecords.set(event);
  }

  protected closeRecords(): void {
    this.openRecords.set(null);
  }

  protected closeAction(): void {
    this.openAction.set(null);
  }

  protected finishAction(): void {
    this.openAction.set(null);
    this.load();
  }

  protected exportCsv(): Promise<void> {
    return this.runExport(() =>
      this.exportService.exportCsv(this.rows(), this.tab(), this.applied())
    );
  }

  protected exportPdf(): Promise<void> {
    return this.runExport(() =>
      this.exportService.exportPdf(this.rows(), this.tab(), this.applied())
    );
  }

  protected back(): void {
    this.router.navigate(['/employees']).catch(() => undefined);
  }

  private async runExport(run: () => Promise<unknown>): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      await run();
    } finally {
      this.exporting.set(false);
    }
  }

  private load(): void {
    this.pending?.unsubscribe();
    this.pending = this.payrollService.getPayrollRows(this.tab(), this.applied()).subscribe({
      next: rows => {
        this.rows.set(rows);
        this.loadFailed.set(false);
        this.loaded.set(true);
      },
      error: () => {
        this.rows.set([]);
        this.loadFailed.set(true);
        this.loaded.set(true);
      },
    });
  }
}
