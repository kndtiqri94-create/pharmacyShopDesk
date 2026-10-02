import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  flag?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private currentLanguageSubject = new BehaviorSubject<string>('en');
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  private availableLanguages: Language[] = [
    { code: 'en', name: 'English', flag: 'gb' },
    { code: 'no', name: 'Norsk', flag: 'no' },
  ];

  constructor(private translateService: TranslateService) {
    this.initializeTranslation();
  }

  private initializeTranslation(): void {
    // Set default language
    this.translateService.setDefaultLang('en');

    // Get language from localStorage or use browser language
    const savedLanguage = localStorage.getItem('preferredLanguage');
    const browserLanguage = this.translateService.getBrowserLang();

    const initialLanguage =
      savedLanguage ||
      (browserLanguage && this.isLanguageSupported(browserLanguage) ? browserLanguage : 'en');

    this.setLanguage(initialLanguage);
  }

  public getAvailableLanguages(): Language[] {
    return this.availableLanguages;
  }

  public getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  public setLanguage(languageCode: string): void {
    if (this.isLanguageSupported(languageCode)) {
      this.translateService.use(languageCode);
      this.currentLanguageSubject.next(languageCode);
      localStorage.setItem('preferredLanguage', languageCode);
    }
  }

  public isLanguageSupported(languageCode: string): boolean {
    return this.availableLanguages.some(lang => lang.code === languageCode);
  }

  public translate(key: string, params?: any): Observable<string> {
    return this.translateService.get(key, params);
  }

  public translateInstant(key: string, params?: any): string {
    return this.translateService.instant(key, params);
  }

  public onLangChange(): Observable<any> {
    return this.translateService.onLangChange;
  }
}
