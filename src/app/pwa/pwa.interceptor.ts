import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, from, map, retry, throwError, timer } from 'rxjs';
import { apiPath, publicContentPath } from './pwa-policy';
import { PublicContentService } from './public-content.service';
import { ConnectivityService } from './connectivity.service';

export const pwaInterceptor: HttpInterceptorFn = (request, next) => {
  const publicPath = publicContentPath(request.urlWithParams);
  if (request.method === 'GET' && publicPath && request.responseType === 'json') {
    return from(inject(PublicContentService).get(publicPath)).pipe(map(body => new HttpResponse({ body, status: 200, url: request.url })));
  }
  if (apiPath(request.url) === null) return next(request);
  const connection = inject(ConnectivityService);
  if (!connection.available()) return throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Se requiere conexión', url: request.url, error: { offline: true } }));
  const lectura = request.method === 'GET';
  const response = next(request.clone({ cache: 'no-store', timeout: lectura ? (request.timeout ?? 12_000) : request.timeout }));
  const result = lectura ? response.pipe(retry({
    count: 1,
    delay: error => connection.available() && error instanceof HttpErrorResponse &&
      [0, 408, 502, 503, 504].includes(error.status)
      ? timer(400 + Math.random() * 300)
      : throwError(() => error),
  })) : response;
  return result.pipe(catchError(error => {
    connection.reportFailure(error);
    return throwError(() => error);
  }));
};
