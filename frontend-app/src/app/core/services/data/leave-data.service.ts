import { Observable } from 'rxjs';
import { LeaveEntitlement } from '../../models/domain/leave-entitlement.model';
import { LeaveRequest } from '../../models/domain/leave-request.model';
import { LeaveType } from '../../models/domain/leave-type.model';

export abstract class LeaveDataService {
  abstract getTypes(): Observable<readonly LeaveType[]>;
  abstract getEntitlements(): Observable<readonly LeaveEntitlement[]>;
  abstract getRequests(): Observable<readonly LeaveRequest[]>;
  abstract saveRequest(request: LeaveRequest): Observable<LeaveRequest>;
}
