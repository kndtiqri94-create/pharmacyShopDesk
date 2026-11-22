import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LeaveEntitlement } from '../../../models/domain/leave-entitlement.model';
import { LeaveRequest } from '../../../models/domain/leave-request.model';
import { LeaveType } from '../../../models/domain/leave-type.model';
import { LeaveDataService } from '../leave-data.service';
import { InMemoryCollection } from './in-memory-collection';
import { LEAVE_ENTITLEMENT_SEED, LEAVE_REQUEST_SEED, LEAVE_TYPE_SEED } from './seed/leave.seed';

@Injectable()
export class InMemoryLeaveDataService extends LeaveDataService {
  private readonly types = new InMemoryCollection<LeaveType>(LEAVE_TYPE_SEED);
  private readonly entitlements = new InMemoryCollection<LeaveEntitlement>(LEAVE_ENTITLEMENT_SEED);
  private readonly requests = new InMemoryCollection<LeaveRequest>(LEAVE_REQUEST_SEED);

  getTypes(): Observable<readonly LeaveType[]> {
    return of(this.types.all());
  }

  getEntitlements(): Observable<readonly LeaveEntitlement[]> {
    return of(this.entitlements.all());
  }

  getRequests(): Observable<readonly LeaveRequest[]> {
    return of(this.requests.all());
  }

  saveRequest(request: LeaveRequest): Observable<LeaveRequest> {
    return of(this.requests.upsert(request));
  }
}
