export class ServerResponse<T> {
  success!: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp!: Date;

  constructor(success: boolean, data?: T, message?: string, errors?: string[]) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.errors = errors;
    this.timestamp = new Date();
  }

  static success<T>(data: T, message?: string): ServerResponse<T> {
    return new ServerResponse(true, data, message);
  }

  static error<T = unknown>(message: string, errors?: string[]): ServerResponse<T> {
    return new ServerResponse<T>(false, undefined as unknown as T, message, errors);
  }
}
