import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoaderService {
  private loading: boolean = false;

  constructor() {}

  setLoading(loading: boolean) {
    this.loading = loading;
  }

  show() {
    this.loading = true;
  }

  hide() {
    this.loading = false;
  }

  getLoading(): boolean {
    return this.loading;
  }
}
