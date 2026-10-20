import { TestBed } from '@angular/core/testing';
import { ImageFileInfo } from '../../../../../core/utils/employee-image.util';
import { LEAVE_ATTACHMENT_ERROR } from '../../../../../core/utils/leave-attachment.util';
import { LeaveAttachmentFieldComponent } from './leave-attachment-field.component';

describe('LeaveAttachmentFieldComponent', () => {
  function mount(fileName: string | null = null, error: string | null = null) {
    const fixture = TestBed.createComponent(LeaveAttachmentFieldComponent);
    fixture.componentRef.setInput('fileName', fileName);
    fixture.componentRef.setInput('error', error);
    const emitted: (ImageFileInfo | null)[] = [];
    fixture.componentInstance.changed.subscribe(value => emitted.push(value));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const choose = (file: File) => {
      const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, element, emitted, choose };
  }

  it('has a Browse label tied to a hidden file input', () => {
    const { element } = mount();
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(element.querySelector(`label[for="${input.id}"]`)?.textContent).toContain('Browse');
    expect(element.textContent).toContain('PDF, JPG or PNG, up to 2 MB.');
  });

  for (const [name, type] of [
    ['a.pdf', 'application/pdf'],
    ['a.jpg', 'image/jpeg'],
    ['a.png', 'image/png'],
  ]) {
    it(`emits the name, type and size for ${name}`, () => {
      const { emitted, choose } = mount();
      choose(new File(['abc'], name, { type }));
      expect(emitted).toEqual([{ name, type, size: 3 }]);
    });
  }

  it('rejects a wrong type without emitting', () => {
    const { element, emitted, choose } = mount();
    choose(new File(['abc'], 'a.exe', { type: 'application/x-msdownload' }));
    expect(emitted).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(LEAVE_ATTACHMENT_ERROR);
  });

  it('rejects a file over 2 MB', () => {
    const { emitted, choose, element } = mount();
    choose(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' }));
    expect(emitted).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('2 MB');
  });

  it('shows the chosen name and removes it', () => {
    const { element, emitted } = mount('scan.pdf');
    expect(element.textContent).toContain('scan.pdf');
    Array.from(element.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Remove'))!
      .click();
    expect(emitted).toEqual([null]);
  });

  it('shows an error passed in from the form', () => {
    const { element } = mount(null, 'Choose a PDF, JPG or PNG file of 2 MB or less');
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });
});
