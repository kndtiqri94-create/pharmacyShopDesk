import { Component, input } from '@angular/core';
import { AttentionItem } from '../../../../../core/models/domain/attention-item.model';
import { formatSyncTime } from '../../../../../core/utils/sync-text.util';

@Component({
  selector: 'app-needs-attention-list',
  templateUrl: './needs-attention-list.component.html',
  styleUrl: './needs-attention-list.component.scss',
})
export class NeedsAttentionListComponent {
  readonly items = input.required<readonly AttentionItem[]>();

  protected when(iso: string): string {
    return formatSyncTime(iso);
  }
}
