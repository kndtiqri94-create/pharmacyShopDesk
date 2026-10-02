import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';

const DEFAULT_DATE_FORMAT = 'MM/dd/yyyy';
const DEFAULT_DATE_TIME_FORMAT = 'MM/dd/yyyy, h:mm:ss a';

@Pipe({
  name: 'localDate',
  pure: false,
  standalone: false,
})
export class LocalDatePipe extends DatePipe implements PipeTransform {
  constructor() {
    super('en-US');
  }

  override transform(value: any, includeTime?: any): any {
    if (value) {
      if (includeTime) {
        return super.transform(value, DEFAULT_DATE_TIME_FORMAT);
      } else {
        return super.transform(value, DEFAULT_DATE_FORMAT);
      }
    } else {
      return value;
    }
  }
}
