import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      (click)="toggleTheme()"
      [matTooltip]="currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
      class="theme-toggle-btn"
      [attr.aria-label]="currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
    >
      <mat-icon
        aria-hidden="false"
        class="material-symbols-outlined"
        aria-label="theme toggle icon"
      >
        {{ currentTheme === 'light' ? 'dark_mode' : 'light_mode' }}
      </mat-icon>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .theme-toggle-btn {
        transition: all 0.3s ease;
      }

      .theme-toggle-btn:hover {
        transform: scale(1.1);
      }

      .theme-toggle-btn .material-symbols-outlined {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    `,
  ],
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  currentTheme: Theme = 'light';
  private subscription: Subscription = new Subscription();

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.themeService.theme$.subscribe(theme => {
        this.currentTheme = theme;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
