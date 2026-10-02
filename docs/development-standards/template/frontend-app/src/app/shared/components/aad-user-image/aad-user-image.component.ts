import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GraphUserService } from '../../services/graph-user.service';

@Component({
  selector: 'app-aad-user-image',
  templateUrl: './aad-user-image.component.html',
  styleUrls: ['./aad-user-image.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AadUserImageComponent implements OnInit {
  @Input() userName: string;
  isImageFound: boolean = false;
  profilePic: any;

  constructor(
    private graphUserService: GraphUserService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    if (this.userName) {
      this.graphUserService
        .getUserImageByEmail(this.userName)
        .pipe(catchError(error => of({ displayName: this.userName })))
        .subscribe({
          next: value => {
            this.profilePic = value;
            if (this.profilePic instanceof ArrayBuffer) {
              this.isImageFound = true;
            }
          },
        });
    }
  }

  arrayBufferToBase64(buffer: any) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  sanitize(url: string) {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
}
