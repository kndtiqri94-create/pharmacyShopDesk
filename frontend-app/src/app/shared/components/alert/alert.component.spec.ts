import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertComponent, AlertTone } from './alert.component';

@Component({
  imports: [AlertComponent],
  template: `<app-alert [tone]="tone" title="Check the expiry">Ask the supplier first.</app-alert>`,
})
class HostComponent {
  tone: AlertTone = 'info';
}

describe('AlertComponent', () => {
  it('shows the title and projected message', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Check the expiry');
    expect(text).toContain('Ask the supplier first.');
  });

  it('supports info, warning and success tones', () => {
    for (const tone of ['info', 'warning', 'success'] as const) {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.tone = tone;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.alert').getAttribute('data-tone')).toBe(tone);
    }
  });
});
