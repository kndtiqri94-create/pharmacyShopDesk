import {
  EMPLOYEE_IMAGE_ERROR,
  EMPLOYEE_IMAGE_MAX_BYTES,
  isImageDataUrl,
  readImageAsDataUrl,
  validateEmployeeImage,
} from './employee-image.util';

const png = { name: 'me.png', type: 'image/png', size: 1000 };

describe('employee image', () => {
  it('accepts jpeg and png by type and extension', () => {
    expect(validateEmployeeImage(png)).toBeNull();
    expect(validateEmployeeImage({ name: 'ME.JPG', type: 'image/jpeg', size: 10 })).toBeNull();
    expect(validateEmployeeImage({ name: 'me.jpeg', type: 'image/jpeg', size: 10 })).toBeNull();
  });

  it('rejects other types and mismatching names', () => {
    const rejected = [
      { name: 'a.gif', type: 'image/gif', size: 10 },
      { name: 'a.svg', type: 'image/svg+xml', size: 10 },
      { name: 'a.pdf', type: 'application/pdf', size: 10 },
      { name: 'a.png', type: 'text/html', size: 10 },
      { name: 'a.exe', type: 'image/png', size: 10 },
      { name: 'png', type: 'image/png', size: 10 },
    ];
    for (const file of rejected) {
      expect(validateEmployeeImage(file)).toBe(EMPLOYEE_IMAGE_ERROR);
    }
  });

  it('allows exactly 2 MB but not one byte more, and not empty files', () => {
    expect(validateEmployeeImage({ ...png, size: EMPLOYEE_IMAGE_MAX_BYTES })).toBeNull();
    expect(validateEmployeeImage({ ...png, size: EMPLOYEE_IMAGE_MAX_BYTES + 1 })).toBe(
      EMPLOYEE_IMAGE_ERROR
    );
    expect(validateEmployeeImage({ ...png, size: 0 })).toBe(EMPLOYEE_IMAGE_ERROR);
  });

  it('states the allowed types and size in the message', () => {
    expect(EMPLOYEE_IMAGE_ERROR).toContain('JPG or PNG');
    expect(EMPLOYEE_IMAGE_ERROR).toContain('2 MB');
  });

  it('recognises image data urls only', () => {
    expect(isImageDataUrl('data:image/png;base64,AAAA')).toBeTrue();
    expect(isImageDataUrl('data:image/jpeg;base64,AAAA')).toBeTrue();
    expect(isImageDataUrl('data:image/svg+xml;base64,AAAA')).toBeFalse();
    expect(isImageDataUrl('javascript:alert(1)')).toBeFalse();
  });

  it('reads a png blob as a data url and refuses non images', async () => {
    const ok = await readImageAsDataUrl(
      new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    );
    expect(ok.startsWith('data:image/png;base64,')).toBeTrue();
    await expectAsync(
      readImageAsDataUrl(new Blob(['<svg/>'], { type: 'image/svg+xml' }))
    ).toBeRejected();
  });
});
