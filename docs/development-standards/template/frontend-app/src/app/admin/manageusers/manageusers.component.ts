import {
  Component,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  AfterViewInit,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialResourceModule } from '@app/material.module';
import { AlertService } from '@app/shared/services/alert.service';
import { UserService } from '@app/shared/services/user.service';
import { LoaderService } from '@app/shared/services/loader.service';
import { SharedModule } from '@app/shared/shared.module';
import { TranslateModule } from '@ngx-translate/core';
import { AddeditUserComponent } from './addedit-user/addedit-user.component';
import { ServerResponse } from '@app/shared/models/dtos/server-response.dto';
import { User } from '@app/shared/models/user/user.model';

let allUserData: User[] = [];

@Component({
  selector: 'app-manageusers',
  imports: [MaterialResourceModule, SharedModule, TranslateModule],
  templateUrl: './manageusers.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './manageusers.component.scss',
})
export class ManageUsersComponent implements OnInit, AfterViewInit {
  users: User[] = [];
  isLoading: boolean = true;
  displayedAllColumns: string[] = ['Email', 'DisplayName', 'Status', 'Edit'];
  allUserDataSource = new MatTableDataSource<User>(allUserData);

  constructor(
    private userService: UserService,
    private alertService: AlertService,
    private loaderService: LoaderService,
    public dialog: MatDialog
  ) {}

  @ViewChild('allPaginator') allPaginator!: MatPaginator;
  @ViewChild('allUserSort') allUserSort!: MatSort;

  ngOnInit(): void {
    this.loadUsers();
  }

  ngAfterViewInit() {
    this.allUserDataSource.paginator = this.allPaginator;
  }

  loadUsers(): void {
    this.allUserDataSource = new MatTableDataSource<User>([]);
    this.isLoading = true;
    this.userService.getAllUsers().subscribe((res: any) => {
      if (res.success) {
        this.users = res.data;
        allUserData = this.updateUserBindingData(res.data);
        this.allUserDataSource = new MatTableDataSource<User>(allUserData);
        this.allUserDataSource.paginator = this.allPaginator;
        this.allUserDataSource.sort = this.allUserSort;
      }

      this.isLoading = false;
    });
  }

  updateUserBindingData(users: User[]): User[] {
    const gridItems: User[] = [];

    for (let index = 0; index < users.length; index++) {
      const item = { ...users[index] } as User;
      gridItems.push(item);
    }

    return gridItems;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.allUserDataSource.filter = filterValue.trim().toLowerCase();

    if (this.allUserDataSource.paginator) {
      this.allUserDataSource.paginator.firstPage();
    }
  }

  addEditUser(id: number): void {
    let modelData = {} as User;

    if (id > 0) {
      const editUser = this.users.find(a => a.id === id);
      if (!editUser) {
        this.alertService.showError('User not found for editing.');
        return;
      }
      modelData = { ...editUser } as User;
    }

    const dialogRef = this.dialog.open(AddeditUserComponent, {
      width: '800px',
      data: modelData,
    });

    dialogRef.afterClosed().subscribe({
      next: async (result: User) => {
        if (!result) {
          return;
        }

        const saveModel = { ...result } as User;

        this.loaderService.setLoading(true);
        this.userService.saveUser(saveModel).subscribe({
          next: (res: ServerResponse<User>) => {
            console.log(res.success);

            this.alertService.success(
              id > 0 ? 'User updated successfully.' : 'User saved successfully.'
            );
            this.loaderService.setLoading(false);
            this.loadUsers();
          },
          error: (error: any) => {
            console.error('Error saving user:', error);
            console.log(error.error.message);
            this.alertService.showError(
              error.error.message,
              id > 0
                ? 'Failed to update user. Please try again.'
                : 'Failed to save user. Please try again.'
            );
            this.loaderService.setLoading(false);
          },
        });
      },
      error: (error: any) => {
        console.error('Error in dialog operation', error);
        this.alertService.showError('An error occurred while opening the user dialog.');
      },
    });
  }
}
