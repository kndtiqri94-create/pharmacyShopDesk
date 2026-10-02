import { Injectable } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

const SUCCESS_TITLE = 'Update Successful';
const ERROR_TITLE = 'Error occurred';
const INFO_TITLE = 'Information';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor(private toastrService: ToastrService) {}

  success(message?: string, title?: string): Observable<never> {
    if (!message) {
      message = 'Record updated successfully. ';
    }
    if (!title) {
      title = SUCCESS_TITLE;
    }
    this.toastrService.success(message, title, {
      timeOut: 3000,
      progressBar: true,
    });
    return EMPTY;
  }

  warn(message: string, error?: Error): Observable<never> {
    error && console.error(message, error);
    this.toastrService.warning(message, INFO_TITLE);
    return EMPTY;
  }

  showError(message: string, title?: string): Observable<never> {
    this.toastrService.error(message, title ? title : ERROR_TITLE);
    return EMPTY;
  }

  showInfo(message: string, title?: string): Observable<never> {
    this.toastrService.info(title ? title : INFO_TITLE, message);
    return EMPTY;
  }
}
