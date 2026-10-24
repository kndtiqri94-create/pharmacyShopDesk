import { Component, inject, output } from '@angular/core';
import { PosService } from '../../../../core/services/pos.service';
import { POS_SHORTCUT_KEYS } from '../../../../core/utils/pos-shortcut.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-pos-actions',
  imports: [ButtonComponent],
  templateUrl: './pos-actions.component.html',
  styleUrl: './pos-actions.component.scss',
})
export class PosActionsComponent {
  readonly saveAndPrintRequested = output<void>();
  readonly saveRequested = output<void>();
  readonly holdRequested = output<void>();
  readonly newBillRequested = output<void>();
  readonly heldBillsRequested = output<void>();

  protected readonly posService = inject(PosService);
  protected readonly keys = POS_SHORTCUT_KEYS;
}
