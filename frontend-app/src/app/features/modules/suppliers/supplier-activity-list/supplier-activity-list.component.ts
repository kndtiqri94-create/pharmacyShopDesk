import { Component, input } from '@angular/core';
import { SupplierActivityItem } from '../../../../core/utils/supplier-activity.util';
import { formatDate } from '../../../../core/utils/date.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-supplier-activity-list',
  imports: [BadgeComponent],
  templateUrl: './supplier-activity-list.component.html',
  styleUrl: './supplier-activity-list.component.scss',
})
export class SupplierActivityListComponent {
  readonly items = input.required<readonly SupplierActivityItem[]>();

  protected readonly formatDate = formatDate;
}
