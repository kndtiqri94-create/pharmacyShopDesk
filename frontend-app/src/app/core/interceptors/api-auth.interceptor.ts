import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_AUTH_TOKEN, API_BASE_URL, isUsableToken } from '../services/api-config';

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  const token = inject(API_AUTH_TOKEN);
  const sendsToApi = isUsableToken(baseUrl) && request.url.startsWith(`${baseUrl}/`);
  if (!sendsToApi || !isUsableToken(token)) return next(request);
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
