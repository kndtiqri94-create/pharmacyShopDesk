import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UserRole } from '@app/shared/models/enums/user-role.enum';
import { MaterialResourceModule } from '@app/material.module';
import { TranslateModule } from '@ngx-translate/core';

export interface DialogData {
  id?: number;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

@Component({
  selector: 'app-addedit-user',
  imports: [FormsModule, MaterialResourceModule, TranslateModule],
  templateUrl: './addedit-user.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './addedit-user.component.scss',
})
export class AddeditUserComponent implements OnInit {
  data: DialogData;
  pageButtonTitle: string = '';
  saveButtonTitle: string = '';
  userRoles = Object.values(UserRole);
  selectedDepartmentId: number | null = null;
  isPrimaryDepartment: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<AddeditUserComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: DialogData
  ) {
    this.data = { ...dialogData };
    this.pageButtonTitle = this.data.id
      ? 'pages.userManagement.editUser'
      : 'pages.userManagement.addUser';
    this.saveButtonTitle = this.data.id ? 'common.actions.update' : 'common.actions.save';
  }

  ngOnInit(): void {}

  get isFormValid(): boolean {
    return !this.data.email || !this.data.name;
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
