import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_AUTH_TOKEN, API_BASE_URL } from '../services/api-config';
import { apiAuthInterceptor } from './api-auth.interceptor';

describe('apiAuthInterceptor', () => {
  function setup(token: string, baseUrl = 'https://api.example.test/api/v1') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiAuthInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: baseUrl },
        { provide: API_AUTH_TOKEN, useValue: token },
      ],
    });
    return { http: TestBed.inject(HttpClient), controller: TestBed.inject(HttpTestingController) };
  }

  it('attaches the bearer token to requests for the API', () => {
    const { http, controller } = setup('secret-token');
    http.get('https://api.example.test/api/v1/sync/pull').subscribe();
    const request = controller.expectOne(() => true);
    expect(request.request.headers.get('Authorization')).toBe('Bearer secret-token');
  });

  it('never sends the token to another origin', () => {
    const { http, controller } = setup('secret-token');
    http.get('https://other.example.test/api/v1/sync/pull').subscribe();
    http.get('https://api.example.test.evil.test/api/v1/x').subscribe();
    http.get('https://api.example.test/other').subscribe();
    const requests = controller.match(() => true);
    expect(requests).toHaveSize(3);
    for (const request of requests) {
      expect(request.request.headers.has('Authorization')).toBeFalse();
    }
  });

  it('sends no header when the token is empty or an unreplaced build placeholder', () => {
    for (const token of ['', '   ', '__API_AUTH_TOKEN__']) {
      TestBed.resetTestingModule();
      const { http, controller } = setup(token);
      http.get('https://api.example.test/api/v1/sync/pull').subscribe();
      expect(controller.expectOne(() => true).request.headers.has('Authorization')).toBeFalse();
    }
  });
});
