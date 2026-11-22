import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Employee } from '../models/domain/employee.model';
import { formatDate } from '../utils/date.util';
import {
  describeEmployeeFilters,
  employeeExportFileName,
  toCsv,
  toExportRows,
  toPdfBytes,
} from '../utils/employee-export.util';
import { EmployeeTableCriteria } from '../utils/employee-list.util';
import { ClockService } from './clock.service';
import { SettingsDataService } from './data/settings-data.service';
import { NotificationService } from './notification.service';

export type EmployeeExportResult =
  { ok: true; fileName: string } | { ok: false; reason: 'empty' | 'failed' };

const CSV_BOM = '﻿';
const CSV_MIME = 'text/csv;charset=utf-8';
const PDF_MIME = 'application/pdf';

@Injectable({ providedIn: 'root' })
export class EmployeeExportService {
  private readonly document = inject(DOCUMENT);
  private readonly clockService = inject(ClockService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly notificationService = inject(NotificationService);

  async exportCsv(employees: readonly Employee[]): Promise<EmployeeExportResult> {
    if (employees.length === 0) return this.empty();
    try {
      const content = CSV_BOM + toCsv(toExportRows(employees));
      const fileName = employeeExportFileName('csv', this.clockService.today());
      this.download(new Blob([content], { type: CSV_MIME }), fileName);
      return { ok: true, fileName };
    } catch {
      return this.failed();
    }
  }

  async exportPdf(
    employees: readonly Employee[],
    criteria: EmployeeTableCriteria
  ): Promise<EmployeeExportResult> {
    if (employees.length === 0) return this.empty();
    try {
      const settings = await firstValueFrom(this.settingsDataService.get());
      const today = this.clockService.today();
      const bytes = toPdfBytes(toExportRows(employees), {
        shopName: settings.shopName,
        madeOn: formatDate(today),
        filters: describeEmployeeFilters(criteria),
      });
      const fileName = employeeExportFileName('pdf', today);
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

  private empty(): EmployeeExportResult {
    this.notificationService.show('info', 'There is nothing to export.');
    return { ok: false, reason: 'empty' };
  }

  private failed(): EmployeeExportResult {
    this.notificationService.showSampleOnly('Export');
    return { ok: false, reason: 'failed' };
  }
}
