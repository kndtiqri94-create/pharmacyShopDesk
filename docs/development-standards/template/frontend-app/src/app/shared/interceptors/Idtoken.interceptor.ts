import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';

@Injectable()
export class IdTokenInterceptor implements HttpInterceptor {
  constructor(private msalService: MsalService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    if (!req.url.startsWith('https://graph.microsoft.com')) {
      const idToken = this.getIdToken();
      if (idToken) {
        const clonedRequest = req.clone({
          setHeaders: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        return next.handle(clonedRequest);
      }
    }

    return next.handle(req);
  }

  getIdToken(): string {
    const account = this.msalService.instance.getActiveAccount();
    if (account && typeof account.idToken === 'string') {
      return account.idToken;
    }
    throw new Error('No active account or idToken found in MSAL. User may not be authenticated.');
  }
}
