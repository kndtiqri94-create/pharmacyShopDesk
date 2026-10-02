import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user/user.model';
import { CreateUserDto } from '../models/dtos/user/create-user.dto';
import { UpdateUserDto } from '../models/dtos/user/update-user.dto';
import { SearchUsersDto } from '../models/dtos/user/search-users.dto';
import { ServerResponse } from '../models/dtos/server-response.dto';
import { ApiUrls } from '../models/enums/api-urls';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<ServerResponse<User[]>> {
    return this.http.get<ServerResponse<any[]>>(`${this.baseUrl}/${ApiUrls.UsersGetAll}`);
  }

  getUserById(id: number): Observable<ServerResponse<User>> {
    return this.http.get<ServerResponse<any>>(`${this.baseUrl}/${ApiUrls.UsersGetById}?id=${id}`);
  }

  searchUsers(searchDto: SearchUsersDto): Observable<ServerResponse<User[]>> {
    return this.http.post<ServerResponse<any[]>>(
      `${this.baseUrl}/${ApiUrls.UsersSearch}`,
      searchDto
    );
  }

  createUser(userData: CreateUserDto): Observable<ServerResponse<User>> {
    return this.http.post<ServerResponse<any>>(`${this.baseUrl}/${ApiUrls.UsersCreate}`, userData);
  }

  updateUser(id: number, userData: UpdateUserDto): Observable<ServerResponse<User>> {
    return this.http.put<ServerResponse<any>>(
      `${this.baseUrl}/${ApiUrls.UsersUpdate}?id=${id}`,
      userData
    );
  }

  deleteUser(id: number): Observable<ServerResponse<boolean>> {
    return this.http.delete<ServerResponse<boolean>>(
      `${this.baseUrl}/${ApiUrls.UsersDelete}?id=${id}`
    );
  }

  saveUser(userData: User): Observable<ServerResponse<User>> {
    if (userData.id) {
      const updateDto: UpdateUserDto = {
        email: userData.email,
        name: userData.name,
        isActive: userData.isActive,
      };
      return this.updateUser(userData.id, updateDto);
    } else {
      const createDto: CreateUserDto = {
        email: userData.email,
        name: userData.name,
        isActive: userData.isActive,
        organizationId: environment.defaultOrganizationId,
      };
      return this.createUser(createDto);
    }
  }
}
