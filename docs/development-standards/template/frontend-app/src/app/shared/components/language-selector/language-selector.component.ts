import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { TranslationService, Language } from '@app/shared/services/translation.service';

@Component({
  selector: 'app-language-selector',
  imports: [MatMenuModule, MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './language-selector.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './language-selector.component.scss',
})
export class LanguageSelectorComponent implements OnInit {
  availableLanguages: Language[] = [];
  currentLanguage: Language | null = null;

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.availableLanguages = this.translationService.getAvailableLanguages();
    this.updateCurrentLanguage();

    this.translationService.currentLanguage$.subscribe(() => {
      this.updateCurrentLanguage();
    });
  }

  private updateCurrentLanguage(): void {
    const currentCode = this.translationService.getCurrentLanguage();
    this.currentLanguage = this.availableLanguages.find(lang => lang.code === currentCode) || null;
  }

  onLanguageSelect(language: Language): void {
    this.translationService.setLanguage(language.code);
  }
}
