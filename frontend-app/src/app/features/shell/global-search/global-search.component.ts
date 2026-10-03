import { Component, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-global-search',
  imports: [IconComponent],
  templateUrl: './global-search.component.html',
  styleUrl: './global-search.component.scss',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class GlobalSearchComponent {
  private readonly notificationService = inject(NotificationService);

  protected showSampleMessage(): void {
    this.notificationService.showSampleOnly('Search');
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.showSampleMessage();
    }
  }
}
