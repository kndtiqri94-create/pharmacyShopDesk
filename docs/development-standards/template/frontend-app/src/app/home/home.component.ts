import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';
import { DomSanitizer } from '@angular/platform-browser';
import { MaterialResourceModule } from '../material.module';
import { SharedModule } from '../shared/shared.module';

@Component({
  selector: 'app-home',
  imports: [MaterialResourceModule, SharedModule],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  loggedInUserDisplayName: string = '';
  loggedInUserName: string = '';
  loggedInUserImage: any = '';
  loggedInUserDesignation: string = '';
  loggedInUserDescription: string = '';
  loggedInUserGraphUserId: string = '';

  isLoadingPendingInterviews: boolean = false;
  isLoadingPendingMRFs: boolean = false;
  isLoadingPendingNotifications: boolean = false;
  isLoadingDashboardData: boolean = false;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.getProfile();
  }

  getProfile() {
    const url = environment.apiConfig.uri;
    this.http.get(url).subscribe((profile: any) => {
      this.loggedInUserDisplayName = profile.displayName;
      this.loggedInUserDesignation = profile.jobTitle;
    });

    try {
      this.http
        .get(url + '/photo/$value', {
          responseType: 'blob',
        })
        .subscribe(res => {
          const objectURL = URL.createObjectURL(res);
          this.loggedInUserImage = this.sanitizer.bypassSecurityTrustUrl(objectURL);
        });
    } catch (error) {
      console.error('Error creating object URL:', error);
    }
  }

  get userInitials(): string {
    const result = 'AA';
    return result;
  }
}
