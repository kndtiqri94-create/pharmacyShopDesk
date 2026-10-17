import { Component, inject } from '@angular/core';
import { ClockService } from '../../../../core/services/clock.service';
import { formatDate } from '../../../../core/utils/date.util';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

@Component({
  selector: 'app-currency-region-section',
  imports: [...FIELD_IMPORTS],
  templateUrl: './currency-region-section.component.html',
  styleUrl: './currency-region-section.component.scss',
})
export class CurrencyRegionSectionComponent {
  protected readonly currency = 'Lankan rupee (LKR)';
  protected readonly dateFormat = formatDate(inject(ClockService).today());
  protected readonly timeZone = 'Asia/Colombo';
}
