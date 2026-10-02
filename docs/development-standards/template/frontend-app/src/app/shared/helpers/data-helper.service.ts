import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface MonthOption {
  value: number;
  label: string;
}

export interface EnumDisplayOption {
  value: string;
  label: string;
  badgeClass?: string;
}

/**
 * DataHelperService - Centralized helper for common data operations
 *
 * PREFERENCE: All enum-related display functions should be moved to this service
 * for consistency and reusability across the application.
 *
 * This service provides:
 * - Month and fiscal year utilities
 * - Enum display name and badge class functions
 * - Generic enum handling methods
 *
 * When adding new enums to the application:
 * 1. Add the enum to the appropriate enum file
 * 2. Add corresponding display methods to this service
 * 3. Update the generic methods if needed
 * 4. Use this service in components instead of inline switch statements
 */
@Injectable({
  providedIn: 'root',
})
export class DataHelperService {
  constructor(private translateService: TranslateService) {}

  /**
   * Returns an array of months with their values and labels
   */
  getMonths(): MonthOption[] {
    return [
      { value: 1, label: this.translateService.instant('months.january') },
      { value: 2, label: this.translateService.instant('months.february') },
      { value: 3, label: this.translateService.instant('months.march') },
      { value: 4, label: this.translateService.instant('months.april') },
      { value: 5, label: this.translateService.instant('months.may') },
      { value: 6, label: this.translateService.instant('months.june') },
      { value: 7, label: this.translateService.instant('months.july') },
      { value: 8, label: this.translateService.instant('months.august') },
      { value: 9, label: this.translateService.instant('months.september') },
      { value: 10, label: this.translateService.instant('months.october') },
      { value: 11, label: this.translateService.instant('months.november') },
      { value: 12, label: this.translateService.instant('months.december') },
    ];
  }

  /**
   * Returns a range of fiscal years based on the current year
   * @param yearsBefore - Number of years before current year (default: 2)
   * @param yearsAfter - Number of years after current year (default: 2)
   */
  getFiscalYears(yearsBefore: number = 2, yearsAfter: number = 2): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];

    for (let year = currentYear - yearsBefore; year <= currentYear + yearsAfter; year++) {
      years.push(year);
    }

    return years;
  }

  /**
   * Gets the display name for a month by its value
   * @param month - The month number (1-12)
   */
  getMonthDisplayName(month: number): string {
    const monthOption = this.getMonths().find(m => m.value === month);
    return monthOption ? monthOption.label : month.toString();
  }
}
