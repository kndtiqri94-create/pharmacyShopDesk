import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LeaveEntitlement } from '../../../models/domain/leave-entitlement.model';
import { LeaveRequest } from '../../../models/domain/leave-request.model';
import { LeaveType } from '../../../models/domain/leave-type.model';
import { LeaveDataService } from '../leave-data.service';
import { LocalCollection } from './local-collection';
import { LocalDatabaseProvider } from './local-database.provider';

@Injectable()
export class LocalLeaveDataService extends LeaveDataService {
  private readonly databaseProvider = inject(LocalDatabaseProvider);

  getTypes(): Observable<readonly LeaveType[]> {
    return this.databaseProvider.observe(db => new LocalCollection<LeaveType>(db.leaveTypes).all());
  }

  getEntitlements(): Observable<readonly LeaveEntitlement[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<LeaveEntitlement>(db.leaveEntitlements).all()
    );
  }

  getRequests(): Observable<readonly LeaveRequest[]> {
    return this.databaseProvider.observe(db =>
      new LocalCollection<LeaveRequest>(db.leaveRequests).all()
    );
  }

  saveRequest(request: LeaveRequest): Observable<LeaveRequest> {
    return this.databaseProvider.observe(db =>
      db.transaction('rw', db.leaveRequests, () =>
        new LocalCollection<LeaveRequest>(db.leaveRequests).upsert(request)
      )
    );
  }
}
