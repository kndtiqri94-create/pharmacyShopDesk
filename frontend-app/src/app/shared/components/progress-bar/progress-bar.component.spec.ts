import { TestBed } from '@angular/core/testing';
import { ProgressBarComponent } from './progress-bar.component';

describe('ProgressBarComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(ProgressBarComponent);
    fixture.componentRef.setInput('value', 62);
    fixture.componentRef.setInput('max', 100);
    fixture.componentRef.setInput('label', 'Reload float');
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('progress') as HTMLProgressElement;
  }

  it('uses the native progress element with value and max', () => {
    const progress = render();
    expect(progress.value).toBe(62);
    expect(progress.max).toBe(100);
  });

  it('has an accessible name', () => {
    expect(render().getAttribute('aria-label')).toBe('Reload float');
  });
});
