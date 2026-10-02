import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiUrls } from '../models/enums/api-urls';
import { ServerResponse } from '../models/dtos/server-response.dto';
import { User } from '../models/user/user.model';
import { UserDepartmentAssignment } from '../models/user/user-department-assignment.model';

@Injectable({
  providedIn: 'root',
})
export class CurrentUserService {
  private baseUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  getCurrentUserProfile(): Observable<ServerResponse<User>> {
    return this.http
      .get<ServerResponse<User>>(`${this.baseUrl}/${ApiUrls.ApplicationUsersGetMyUserProfile}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching current user profile:', error);
          // Never return anything on error - let the error propagate
          return throwError(() => error);
        })
      );
  }

  loadCurrentUser(): void {
    this.getCurrentUserProfile().subscribe({
      next: profileData => {
        this.currentUserSubject.next(profileData?.data || null);
      },
      error: error => {
        console.error('Error loading current user profile:', error);
        this.currentUserSubject.next(null);
      },
    });
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getPrimaryDepartmentId(): number | null {
    const user = this.getCurrentUser();
    if (!user?.departmentAssignments) {
      return null;
    }

    const primaryAssignment = user.departmentAssignments.find(assignment => assignment.isPrimary);
    return primaryAssignment?.departmentId || null;
  }

  getAssignedDepartments(): UserDepartmentAssignment[] {
    const user = this.getCurrentUser();
    console.log('user', user);
    return user?.departmentAssignments || [];
  }

  canCreateBudgetRequestForDepartment(departmentId: number): boolean {
    const user = this.getCurrentUser();
    if (!user?.departmentAssignments) {
      return false;
    }

    // User can only create budget requests for their primary department
    const primaryAssignment = user.departmentAssignments.find(assignment => assignment.isPrimary);
    return primaryAssignment?.departmentId === departmentId;
  }

  isAssignedToDepartment(departmentId: number): boolean {
    const user = this.getCurrentUser();
    if (!user?.departmentAssignments) {
      return false;
    }

    return user.departmentAssignments.some(assignment => assignment.departmentId === departmentId);
  }

  // Method to check if user is assigned to a finance department using the isFinanceDepartment flag
  // This requires the full department data to be available
  isFinanceUserWithDepartmentData(departments: any[]): boolean {
    const user = this.getCurrentUser();
    if (!user) {
      return false;
    }

    // Check if user has DEPARTMENT_MANAGER role
    //if (user.role !== 'DEPARTMENT_MANAGER' && user.role !== 'ADMIN') {
    //  return false;
    //}

    // Check if user is assigned to any Finance department
    if (!user.departmentAssignments || user.departmentAssignments.length === 0) {
      return false;
    }

    // Check if any of the user's assigned departments have isFinanceDepartment = true
    return user.departmentAssignments.some(assignment => {
      const department = departments.find(d => d.id === assignment.departmentId);
      return department && department.isFinanceDepartment === true;
    });
  }
}
