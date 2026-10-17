import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LeaveRecord } from '../../../models/domain/leave-record.model';
import { LeaveDataService } from '../leave-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { LEAVE_SEED } from './seed/leave.seed';

@Injectable()
export class InMemoryLeaveDataService extends LeaveDataService {
  private readonly collection = new InMemoryCollection<LeaveRecord>(LEAVE_SEED);

  getAll(): Observable<readonly LeaveRecord[]> {
    return of(this.collection.all());
  }
}
