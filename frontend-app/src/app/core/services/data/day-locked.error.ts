export class DayLockedError extends Error {
  constructor(readonly date: string) {
    super(`The day ${date} is locked.`);
    this.name = 'DayLockedError';
  }
}
