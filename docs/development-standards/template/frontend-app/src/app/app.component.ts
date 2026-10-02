import {
  Component,
  OnInit,
  Inject,
  OnDestroy,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  MsalService,
  MsalModule,
  MsalBroadcastService,
  MSAL_GUARD_CONFIG,
  MsalGuardConfiguration,
} from '@azure/msal-angular';
import {
  AuthenticationResult,
  InteractionStatus,
  PopupRequest,
  RedirectRequest,
  EventMessage,
  EventType,
} from '@azure/msal-browser';
import { Subject, Subscription } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { MaterialResourceModule } from './material.module';
import { SharedModule } from './shared/shared.module';
import { ThemeToggleComponent } from './shared/components/theme-toggle/theme-toggle.component';
import { LocalStorageService } from './shared/helpers/local-storage.service';
import { LanguageSelectorComponent } from './shared/components/language-selector/language-selector.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    MsalModule,
    RouterOutlet,
    RouterLink,
    MaterialResourceModule,
    SharedModule,
    ThemeToggleComponent,
    LanguageSelectorComponent,
    TranslateModule,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Smart Hire';
  isIframe = false;
  loginDisplay = false;
  mobileView = false;
  userOrganizationInitlized = false;
  userNotAuthorized = false;
  defaultUserCreationInitlized = false;
  loggedInUserDisplayEmail: string = '';
  loggedInUserDisplayName: string = '';
  loggedInUserName: string = '';
  loggedInUserImage: any = '';
  loggedInUserDesignation: string = '';
  userImageSub: Subscription | undefined;
  userProfileSub: Subscription | undefined;
  subscriptions: Subscription[] = [];
  sidenavOpened: boolean = true; // Default to opened

  private readonly _destroying$ = new Subject<void>();
  private readonly SIDENAV_STATE_KEY = 'sidenav-opened';
  image: any;
  innerWindowHeight!: number;
  constructor(
    @Inject(MSAL_GUARD_CONFIG)
    private msalGuardConfig: MsalGuardConfiguration,
    private authService: MsalService,
    private msalBroadcastService: MsalBroadcastService,
    private router: Router,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private localStorageService: LocalStorageService
  ) {}

  @HostListener('window:resize')
  onResize() {
    const wasMobile = this.mobileView;
    this.mobileView = window.innerWidth < 768;

    // If switching to mobile view, close the sidenav
    if (!wasMobile && this.mobileView) {
      this.sidenavOpened = false;
      this.saveSidenavState();
    }
    // If switching from mobile to desktop, restore the saved state or default to open
    else if (wasMobile && !this.mobileView) {
      this.loadSidenavState();
    }
  }

  ngOnInit(): void {
    this.setHeight();
    this.authService.handleRedirectObservable().subscribe();
    this.isIframe = window !== window.parent && !window.opener; // Remove this line to use Angular Universal
    this.mobileView = window.innerWidth < 768;
    this.loadSidenavState();
    this.setLoginDisplay();

    this.authService.instance.enableAccountStorageEvents(); // Optional - This will enable ACCOUNT_ADDED and ACCOUNT_REMOVED events emitted when a user logs in or out of another tab or window
    this.msalBroadcastService.msalSubject$
      .pipe(
        filter(
          (msg: EventMessage) =>
            msg.eventType === EventType.ACCOUNT_ADDED || msg.eventType === EventType.ACCOUNT_REMOVED
        )
      )
      .subscribe(() => {
        if (this.authService.instance.getAllAccounts().length === 0) {
          window.location.pathname = '/';
        } else {
          this.setLoginDisplay();
        }
      });

    this.msalBroadcastService.inProgress$
      .pipe(
        filter((status: InteractionStatus) => status === InteractionStatus.None),
        takeUntil(this._destroying$)
      )
      .subscribe(() => {
        this.setLoginDisplay();
        this.checkAndSetActiveAccount();
      });

    this.getProfile();
  }

  private loadSidenavState(): void {
    // Load saved sidenav state from localStorage
    const savedState = this.localStorageService.getItem<boolean>(this.SIDENAV_STATE_KEY);

    if (this.mobileView) {
      // On mobile, always start with sidenav closed
      this.sidenavOpened = false;
    } else {
      // On desktop, use saved state or default to open
      if (savedState !== null) {
        this.sidenavOpened = savedState;
      } else {
        this.sidenavOpened = true; // Default to open on desktop
      }
    }
  }

  private saveSidenavState(): void {
    // Only save the state if not on mobile (mobile always starts closed)
    if (!this.mobileView) {
      this.localStorageService.setItem(this.SIDENAV_STATE_KEY, this.sidenavOpened);
    }
  }

  private setHeight() {
    const windowHeight = window?.innerHeight;
    const topOffset = 92;
    this.innerWindowHeight = windowHeight - topOffset;
  }

  getProfile() {
    const url = environment.apiConfig.uri;
    this.http.get(url).subscribe((profile: any) => {
      this.loggedInUserDisplayEmail = profile.mail;
      this.loggedInUserDisplayName = profile.displayName;
      this.loggedInUserDesignation = profile.jobTitle;
      if (!profile.jobTitle) {
        this.loggedInUserDesignation = profile.mail;
      }

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
      this.userOrganizationInitlized = true;
    });
  }

  setLoginDisplay() {
    this.loginDisplay = this.authService.instance.getAllAccounts().length > 0;
  }

  checkAndSetActiveAccount() {
    /**
     * If no active account set but there are accounts signed in, sets first account to active account
     * To use active account set here, subscribe to inProgress$ first in your component
     * Note: Basic usage demonstrated. Your app may require more complicated account selection logic
     */
    const activeAccount = this.authService.instance.getActiveAccount();

    if (!activeAccount && this.authService.instance.getAllAccounts().length > 0) {
      const accounts = this.authService.instance.getAllAccounts();
      this.authService.instance.setActiveAccount(accounts[0]);
    }
  }

  loginRedirect() {
    if (this.msalGuardConfig.authRequest) {
      this.authService.loginRedirect({
        ...this.msalGuardConfig.authRequest,
      } as RedirectRequest);
    } else {
      this.authService.loginRedirect();
    }
  }

  loginPopup() {
    if (this.msalGuardConfig.authRequest) {
      this.authService
        .loginPopup({ ...this.msalGuardConfig.authRequest } as PopupRequest)
        .subscribe((response: AuthenticationResult) => {
          this.authService.instance.setActiveAccount(response.account);
        });
    } else {
      this.authService.loginPopup().subscribe((response: AuthenticationResult) => {
        this.authService.instance.setActiveAccount(response.account);
      });
    }
  }

  logout(popup?: boolean) {
    if (popup) {
      this.authService.logoutPopup({
        mainWindowRedirectUri: '/',
      });
    } else {
      this.authService.logoutRedirect();
    }
  }

  isMobile(): boolean {
    return this.mobileView;
  }

  onSidenavToggle(opened: boolean): void {
    // This method is called when the sidenav is opened/closed by user interaction
    this.sidenavOpened = opened;
    this.saveSidenavState();
  }

  toggleSidenav(): void {
    this.sidenavOpened = !this.sidenavOpened;
    this.saveSidenavState();
  }

  isCurrentRout(route: string[]): boolean {
    let result = false;
    route.forEach(routePart => {
      if (routePart === '/') {
        if (this.router.url === routePart) {
          result = true;
        }
      } else {
        if (this.router.url.includes(routePart)) {
          result = true;
        }
      }
    });
    return result;
  }

  transform(html: string) {
    return html ? this.sanitizer.bypassSecurityTrustResourceUrl(html) : '';
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }

  get userInitials(): string {
    if (!this.loggedInUserDisplayName || this.loggedInUserDisplayName.trim() === '') {
      return '..';
    }

    let result = '';
    const nameParts = this.loggedInUserDisplayName
      .trim()
      .split(' ')
      .filter(part => part.length > 0);

    if (nameParts.length === 0) {
      return 'U';
    }

    if (nameParts.length >= 1) {
      result = nameParts[0].substring(0, 1).toUpperCase();
    }

    if (nameParts.length > 1) {
      result += nameParts[1].substring(0, 1).toUpperCase();
    }

    return result;
  }

  onUserProfileClick(): void {
    // TODO: Implement user profile functionality
    // This could open a user profile dialog, navigate to profile page, or show user menu
    console.log('User profile clicked:', this.loggedInUserDisplayName);
  }
}
