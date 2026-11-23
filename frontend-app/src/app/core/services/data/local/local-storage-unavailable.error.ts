export const LOCAL_STORAGE_UNAVAILABLE_MESSAGE =
  'This browser cannot store ShopDesk data on this device. Turn off private browsing, allow site data for this page, or use another browser, then reload.';

export class LocalStorageUnavailableError extends Error {
  constructor() {
    super(LOCAL_STORAGE_UNAVAILABLE_MESSAGE);
    this.name = 'LocalStorageUnavailableError';
  }
}
