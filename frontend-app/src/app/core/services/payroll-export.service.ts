import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModuleKey } from '../models/enums/module-key.enum';
import { formatDate } from '../utils/date.util';
import {
  PAYROLL_SAMPLE_NOTE,
  describePayrollFilters,
  payrollExportFileName,
  toPayrollCsv,
  toPayrollExportRows,
  toPayrollPdfBytes,
} from '../utils/payroll-export.util';
import { PayrollFilters, PayrollTab } from '../utils/payroll-list.util';
import { ClockService } from './clock.service';
import { SettingsDataService } from './data/settings-data.service';
import { NotificationService } from './notification.service';
import { PayrollRow } from './payroll.service';
import { PermissionService } from './permission.service';

export type PayrollExportResult =
  { ok: true; fileName: string } | { ok: false; reason: 'empty' | 'failed' | 'denied' };

const CSV_BOM = '﻿';
const CSV_MIME = 'text/csv;charset=utf-8';
const PDF_MIME = 'application/pdf';

@Injectable({ providedIn: 'root' })
export class PayrollExportService {
  private readonly document = inject(DOCUMENT);
  private readonly clockService = inject(ClockService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  async exportCsv(
    rows: readonly PayrollRow[],
    tab: PayrollTab,
    filters: PayrollFilters
  ): Promise<PayrollExportResult> {
    if (!this.permissionService.canView(ModuleKey.PAYROLL)) return this.denied();
    if (rows.length === 0) return this.empty();
    try {
      const content = CSV_BOM + toPayrollCsv(toPayrollExportRows(rows, tab), tab);
      const fileName = payrollExportFileName('csv', tab, filters);
      this.download(new Blob([content], { type: CSV_MIME }), fileName);
      return { ok: true, fileName };
    } catch {
      return this.failed();
    }
  }

  async exportPdf(
    rows: readonly PayrollRow[],
    tab: PayrollTab,
    filters: PayrollFilters
  ): Promise<PayrollExportResult> {
    if (!this.permissionService.canView(ModuleKey.PAYROLL)) return this.denied();
    if (rows.length === 0) return this.empty();
    try {
      const settings = await firstValueFrom(this.settingsDataService.get());
      const bytes = toPayrollPdfBytes(toPayrollExportRows(rows, tab), tab, {
        shopName: settings.shopName,
        madeOn: formatDate(this.clockService.today()),
        filters: describePayrollFilters(tab, filters),
        note: PAYROLL_SAMPLE_NOTE,
      });
      const fileName = payrollExportFileName('pdf', tab, filters);
      this.download(new Blob([bytes as BlobPart], { type: PDF_MIME }), fileName);
      return { ok: true, fileName };
    } catch {
      return this.failed();
    }
  }

  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    try {
      const link = this.document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private denied(): PayrollExportResult {
    this.notificationService.show('warning', 'You do not have access to export salaries.');
    return { ok: false, reason: 'denied' };
  }

  private empty(): PayrollExportResult {
    this.notificationService.show('info', 'There is nothing to export.');
    return { ok: false, reason: 'empty' };
  }

  private failed(): PayrollExportResult {
    this.notificationService.showSampleOnly('Export');
    return { ok: false, reason: 'failed' };
  }
}
