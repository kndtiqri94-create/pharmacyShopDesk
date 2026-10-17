import { Observable } from 'rxjs';
import { LeaveRecord } from '../../models/domain/leave-record.model';

export abstract class LeaveDataService {
  abstract getAll(): Observable<readonly LeaveRecord[]>;
}
