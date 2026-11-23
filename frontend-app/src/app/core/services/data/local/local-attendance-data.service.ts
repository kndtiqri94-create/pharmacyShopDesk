import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AttendanceRecord } from '../../../models/domain/attendance-record.model';
import { AttendanceDataService } from '../attendance-data.service';
import { stripRow } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalAttendanceDataService extends AttendanceDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getForDate(date: string): Observable<readonly AttendanceRecord[]> {
    return this.databaseProvider.observe(async db => {
      const rows = await db.attendance.where('date').equals(date).sortBy('_ord');
      return rows.map(row => stripRow<AttendanceRecord>(row));
    });
  }
}
