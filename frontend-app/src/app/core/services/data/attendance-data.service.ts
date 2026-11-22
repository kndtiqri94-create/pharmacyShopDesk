import { Observable } from 'rxjs';
import { AttendanceRecord } from '../../models/domain/attendance-record.model';

export abstract class AttendanceDataService {
  abstract getForDate(date: string): Observable<readonly AttendanceRecord[]>;
}
