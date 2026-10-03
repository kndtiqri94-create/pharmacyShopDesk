import { TestBed } from '@angular/core/testing';
import { AvatarComponent, initialsFromName } from './avatar.component';

describe('AvatarComponent', () => {
  it('derives initials from the first two words', () => {
    expect(initialsFromName('Nimal Perera')).toBe('NP');
    expect(initialsFromName('  ruwani   jayawardena  silva')).toBe('RJ');
    expect(initialsFromName('Madonna')).toBe('M');
    expect(initialsFromName('')).toBe('');
  });

  it('shows initials and names the person for assistive tech', () => {
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('name', 'Kamal Silva');
    fixture.detectChanges();
    const avatar = fixture.nativeElement.querySelector('.avatar') as HTMLElement;
    expect(avatar.textContent).toBe('KS');
    expect(avatar.getAttribute('aria-label')).toBe('Kamal Silva');
  });

  it('prefers explicit initials', () => {
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('name', 'Nimal Perera');
    fixture.componentRef.setInput('initials', 'NP');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.avatar').textContent).toBe('NP');
  });
});
