import { Component } from '@angular/core';
import { FallbackPageComponent } from '../fallback-page/fallback-page.component';

@Component({
  selector: 'app-not-found',
  imports: [FallbackPageComponent],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {}
