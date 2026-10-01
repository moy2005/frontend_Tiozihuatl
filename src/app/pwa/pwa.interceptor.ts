import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, from, map, throwError } from 'rxjs';
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
  return next(request.clone({ cache: 'no-store' })).pipe(catchError(error => {
    connection.reportFailure(error);
    return throwError(() => error);
  }));
};
