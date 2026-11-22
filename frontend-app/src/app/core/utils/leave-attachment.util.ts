import { ImageFileInfo } from './employee-image.util';

export const LEAVE_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
export const LEAVE_ATTACHMENT_NAME_MAX = 150;
export const LEAVE_ATTACHMENT_ERROR = 'Choose a PDF, JPG or PNG file of 2 MB or less';

const ALLOWED_MIME_TYPES: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS: readonly string[] = ['.pdf', '.jpg', '.jpeg', '.png'];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

export function validateLeaveAttachment(file: ImageFileInfo): string | null {
  const typeOk = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());
  const extensionOk = ALLOWED_EXTENSIONS.includes(extensionOf(file.name));
  const sizeOk = file.size > 0 && file.size <= LEAVE_ATTACHMENT_MAX_BYTES;
  const nameOk = file.name.length > 0 && file.name.length <= LEAVE_ATTACHMENT_NAME_MAX;
  return typeOk && extensionOk && sizeOk && nameOk ? null : LEAVE_ATTACHMENT_ERROR;
}
