import { Component, inject } from '@angular/core';
import { StoragePersistenceService } from '../../../core/services/data/local/storage-persistence.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-storage-warning',
  imports: [AlertComponent],
  templateUrl: './storage-warning.component.html',
  styleUrl: './storage-warning.component.scss',
})
export class StorageWarningComponent {
  protected readonly storagePersistenceService = inject(StoragePersistenceService);
}
