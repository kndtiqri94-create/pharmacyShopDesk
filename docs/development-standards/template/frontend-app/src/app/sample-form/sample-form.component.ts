import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { QuillModule } from 'ngx-quill';
import { MaterialResourceModule } from '../material.module';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sample-form',
  imports: [
    MaterialResourceModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    ReactiveFormsModule,
    QuillModule,
  ],
  templateUrl: './sample-form.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sample-form.component.scss',
})
export class SampleFormComponent {
  sampleObject: any = {};
  isOnEditMode: boolean = false;

  modulesBubble = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'], // toggled buttons
      ['blockquote', 'code-block'],
      [{ header: 1 }, { header: 2 }], // custom button values
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
      [{ size: ['small', false, 'large', 'huge'] }], // custom dropdown
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      ['clean'], // remove formatting button
    ],
  };

  constructor(private router: Router) {}

  get pageTitle(): string {
    return 'Sample Form';
  }

  get isFormValid(): boolean {
    return true;
  }

  navigateBackToList() {
    this.router.navigate(['/mrflist']);
  }
}
