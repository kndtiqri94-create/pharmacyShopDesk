export class DuplicateBankAccountError extends Error {
  constructor() {
    super('This account already exists for that bank.');
    this.name = 'DuplicateBankAccountError';
  }
}
