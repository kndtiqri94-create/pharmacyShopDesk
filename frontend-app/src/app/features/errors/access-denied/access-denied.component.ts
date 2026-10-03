import { Component } from '@angular/core';
import { FallbackPageComponent } from '../fallback-page/fallback-page.component';

@Component({
  selector: 'app-access-denied',
  imports: [FallbackPageComponent],
  templateUrl: './access-denied.component.html',
  styleUrl: './access-denied.component.scss',
})
export class AccessDeniedComponent {}
