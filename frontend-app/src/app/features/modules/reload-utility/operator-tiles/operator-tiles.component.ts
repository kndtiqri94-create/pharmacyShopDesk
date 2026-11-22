import { Component, input, model } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { createUniqueId } from '../../../../shared/utils/unique-id.util';

export const OPERATOR_FIRST_TILE_ID = 'reload-operator';

@Component({
  selector: 'app-operator-tiles',
  imports: [IconComponent],
  templateUrl: './operator-tiles.component.html',
  styleUrl: './operator-tiles.component.scss',
})
export class OperatorTilesComponent {
  readonly operators = input.required<readonly string[]>();
  readonly value = model('');
  readonly disabled = input(false);
  readonly error = input<string | null>(null);

  protected readonly groupName = createUniqueId('operator');
  protected readonly errorId = createUniqueId('operator-error');
  protected readonly firstTileId = OPERATOR_FIRST_TILE_ID;
}
