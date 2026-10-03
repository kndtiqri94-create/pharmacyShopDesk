import { TestBed } from '@angular/core/testing';
import { hasNoExclamation } from '../../../core/utils/content-rules.util';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  it('says what to do next in plain words', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'No purchase orders yet');
    fixture.componentRef.setInput('message', 'Create the first one.');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No purchase orders yet');
    expect(text).toContain('Create the first one.');
    expect(hasNoExclamation(text)).toBeTrue();
  });
});
