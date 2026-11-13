import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CashBookReport } from '../models/domain/cash-book-ledger.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import {
  CASH_BOOK_SAMPLE_NOTE,
  cashBookExportFileName,
  toCashBookCsv,
  toCashBookPdfBytes,
} from '../utils/cash-book-export.util';
import { formatDate } from '../utils/date.util';
import { ClockService } from './clock.service';
import { SettingsDataService } from './data/settings-data.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';

export type CashBookExportResult =
  { ok: true; fileName: string } | { ok: false; reason: 'failed' | 'denied' | 'busy' };

const CSV_BOM = '﻿';
const CSV_MIME = 'text/csv;charset=utf-8';
const PDF_MIME = 'application/pdf';

@Injectable({ providedIn: 'root' })
export class CashBookExportService {
  private readonly document = inject(DOCUMENT);
  private readonly clockService = inject(ClockService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private exporting = false;

  exportCsv(report: CashBookReport): Promise<CashBookExportResult> {
    return this.run(() => {
      const content = CSV_BOM + toCashBookCsv(report);
      return Promise.resolve(
        this.deliver(new Blob([content], { type: CSV_MIME }), cashBookExportFileName('csv', report))
      );
    });
  }

  exportPdf(report: CashBookReport): Promise<CashBookExportResult> {
    return this.run(async () => {
      const settings = await firstValueFrom(this.settingsDataService.get());
      const bytes = toCashBookPdfBytes(report, {
        shopName: settings.shopName,
        madeOn: formatDate(this.clockService.today()),
        note: CASH_BOOK_SAMPLE_NOTE,
      });
      return this.deliver(
        new Blob([bytes as BlobPart], { type: PDF_MIME }),
        cashBookExportFileName('pdf', report)
      );
    });
  }

  private async run(work: () => Promise<CashBookExportResult>): Promise<CashBookExportResult> {
    if (!this.permissionService.canView(ModuleKey.POS)) {
      this.notificationService.show('warning', 'You do not have access to export the cash book.');
      return { ok: false, reason: 'denied' };
    }
    if (this.exporting) return { ok: false, reason: 'busy' };
    this.exporting = true;
    try {
      return await work();
    } catch {
      this.notificationService.showSampleOnly('Export');
      return { ok: false, reason: 'failed' };
    } finally {
      this.exporting = false;
    }
  }

  private deliver(blob: Blob, fileName: string): CashBookExportResult {
    const url = URL.createObjectURL(blob);
    try {
      const link = this.document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    } finally {
      URL.revokeObjectURL(url);
    }
    this.notificationService.show('success', 'Cash book export ready.');
    return { ok: true, fileName };
  }
}
