import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtillHelperService {
  constructor() {}

  getDate(date: any): Date {
    if (!date) {
      return date;
    }
    const _date = new Date(date);
    return new Date(Date.UTC(_date.getFullYear(), _date.getMonth(), _date.getDate()));
  }

  getDateStringForAPI(date: any): string {
    if (!date) {
      return date;
    }

    const inputDate = new Date(date);
    const year = inputDate.getFullYear();
    const month = inputDate.getMonth() + 1;
    const day = inputDate.getDate();
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T00:00:00.000Z`;
  }
}
