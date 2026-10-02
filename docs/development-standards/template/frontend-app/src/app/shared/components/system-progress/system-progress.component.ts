import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LoaderService } from '../../services/loader.service';

@Component({
  selector: 'app-system-progress',
  templateUrl: './system-progress.component.html',
  styleUrls: ['./system-progress.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SystemProgressComponent {
  constructor(public loader: LoaderService) {}
}
