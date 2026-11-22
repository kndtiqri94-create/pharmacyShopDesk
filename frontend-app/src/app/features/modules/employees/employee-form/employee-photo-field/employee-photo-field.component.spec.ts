import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPLOYEE_IMAGE_ERROR } from '../../../../../core/utils/employee-image.util';
import { EmployeePhotoFieldComponent } from './employee-photo-field.component';

describe('EmployeePhotoFieldComponent', () => {
  const PNG_URL = 'data:image/png;base64,iVBORw0KGgo=';

  function mount(options: { photo?: string | null; readOnly?: boolean } = {}) {
    const fixture: ComponentFixture<EmployeePhotoFieldComponent> = TestBed.createComponent(
      EmployeePhotoFieldComponent
    );
    fixture.componentRef.setInput('photoDataUrl', options.photo ?? null);
    fixture.componentRef.setInput('employeeName', 'Nimal Perera');
    fixture.componentRef.setInput('readOnly', options.readOnly ?? false);
    const emitted: (string | null)[] = [];
    fixture.componentInstance.changed.subscribe(value => emitted.push(value));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
  }

  async function choose(
    fixture: ComponentFixture<EmployeePhotoFieldComponent>,
    file: File
  ): Promise<void> {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[type="file"]'
    )!;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    await new Promise(resolve => setTimeout(resolve, 50));
    fixture.detectChanges();
  }

  it('shows a placeholder, a labelled hidden input and no remove button without a picture', () => {
    const { element } = mount();
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('[aria-label="No picture chosen"]')).not.toBeNull();
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(element.querySelector(`label[for="${input.id}"]`)?.textContent).toContain('Choose');
    expect(element.textContent).not.toContain('Remove');
  });

  it('shows the preview with alt text free of redundant words, plus replace and remove', () => {
    const { element } = mount({ photo: PNG_URL });
    const img = element.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(PNG_URL);
    expect(img.alt).toBe('Portrait of Nimal Perera');
    expect(img.alt.toLowerCase()).not.toMatch(/photo|image/);
    expect(element.textContent).toContain('Replace picture');
    expect(element.textContent).toContain('Remove');
  });

  it('emits the data URL for a valid PNG', async () => {
    const { fixture, emitted } = mount();
    await choose(
      fixture,
      new File([new Uint8Array([137, 80, 78, 71])], 'me.png', { type: 'image/png' })
    );
    expect(emitted.length).toBe(1);
    expect(emitted[0]).toContain('data:image/png;base64,');
  });

  it('rejects a wrong type with a message and emits nothing', async () => {
    const { fixture, element, emitted } = mount({ photo: PNG_URL });
    await choose(fixture, new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(emitted).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(EMPLOYEE_IMAGE_ERROR);
    expect(element.querySelector('img')?.getAttribute('src')).toBe(PNG_URL);
  });

  it('rejects a file over 2 MB', async () => {
    const { fixture, element, emitted } = mount();
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });
    await choose(fixture, big);
    expect(emitted).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('2 MB');
  });

  it('removes the picture', () => {
    const { element, emitted } = mount({ photo: PNG_URL });
    const remove = Array.from(element.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Remove')
    )!;
    remove.click();
    expect(emitted).toEqual([null]);
  });

  it('hides all change controls in read-only mode', () => {
    const { element } = mount({ photo: PNG_URL, readOnly: true });
    expect(element.querySelector('input[type="file"]')).toBeNull();
    expect(element.querySelector('label')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('img')).not.toBeNull();
  });
});
