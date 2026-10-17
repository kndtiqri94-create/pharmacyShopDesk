import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AttendanceRecord } from '../../../models/domain/attendance-record.model';
import { AttendanceDataService } from '../attendance-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { ATTENDANCE_SEED } from './seed/attendance.seed';

@Injectable()
export class InMemoryAttendanceDataService extends AttendanceDataService {
  private readonly collection = new InMemoryCollection<AttendanceRecord>(ATTENDANCE_SEED);

  getForDate(date: string): Observable<readonly AttendanceRecord[]> {
    return of(this.collection.all().filter(record => record.date === date));
  }
}
