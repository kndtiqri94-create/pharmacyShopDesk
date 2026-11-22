export const EMPLOYEE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const EMPLOYEE_IMAGE_ERROR = 'Choose a JPG or PNG image of 2 MB or less';

const ALLOWED_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png'];
const DATA_URL_PREFIXES: readonly string[] = ['data:image/jpeg;base64,', 'data:image/png;base64,'];

export interface ImageFileInfo {
  name: string;
  type: string;
  size: number;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

export function validateEmployeeImage(file: ImageFileInfo): string | null {
  const typeOk = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());
  const extensionOk = ALLOWED_EXTENSIONS.includes(extensionOf(file.name));
  const sizeOk = file.size > 0 && file.size <= EMPLOYEE_IMAGE_MAX_BYTES;
  return typeOk && extensionOk && sizeOk ? null : EMPLOYEE_IMAGE_ERROR;
}

export function isImageDataUrl(value: string): boolean {
  return DATA_URL_PREFIXES.some(prefix => value.startsWith(prefix));
}

export function readImageAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && isImageDataUrl(result)) resolve(result);
      else reject(new Error(EMPLOYEE_IMAGE_ERROR));
    };
    reader.onerror = () => reject(new Error(EMPLOYEE_IMAGE_ERROR));
    reader.readAsDataURL(file);
  });
}
