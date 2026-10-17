export function syncDialogState(dialog: HTMLDialogElement, open: boolean): boolean {
  if (open && !dialog.open) {
    dialog.showModal();
    return true;
  }
  if (!open && dialog.open) dialog.close();
  return false;
}
