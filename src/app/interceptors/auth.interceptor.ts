import { inject } from '@angular/core';
import { HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { AuthService } from '../api/services/auth';
import { Observable, catchError, switchMap, throwError, timer } from 'rxjs';

const isRefreshRequest = (url: string) => url.includes('/auth/refresh');

const isSessionBootstrapRequest = (url: string) =>
  url.includes('/auth/login') ||
  url.includes('/auth/register') ||
  url.includes('/auth/pre-registro') ||
  url.includes('/auth/verify-email') ||
  url.includes('/auth/finalizar-registro') ||
  url.includes('/auth/activate-account') ||
  url.includes('/password/') ||
  url.includes('/sms/') ||
  url.includes('/oauth/') ||
  url.includes('/webauthn/');

const attachAccessToken = (req: HttpRequest<unknown>, token: string | null) =>
  token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

const shouldRetryWithRefresh = (err: any) => {
  if (err?.status === 401) return true;

  if (err?.status === 403) {
    const message = String(err?.error?.error || err?.error?.message || '').toLowerCase();
    return message.includes('token') || message.includes('no autorizado');
  }

  return false;
};

const shouldRetryTransientRequest = (req: HttpRequest<unknown>, err: any) => {
  if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) return false;

  const status = Number(err?.status);
  return status === 0 || status === 502 || status === 503 || status === 504;
};

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const isBootstrapRequest = isSessionBootstrapRequest(req.url);

  const sendRequest = (allowTransientRetry = true): Observable<HttpEvent<unknown>> =>
    next(attachAccessToken(req, authService.getAccessToken())).pipe(
      catchError((err) => {
        if (allowTransientRetry && shouldRetryTransientRequest(req, err)) {
          return timer(450).pipe(
            switchMap(() => sendRequest(false)),
          );
        }

        return throwError(() => err);
      }),
    );

  if (isRefreshRequest(req.url)) {
    return next(req).pipe(
      catchError((err) => {
        if (err.status === 401 || err.status === 403) {
          authService.clearSession();
        }
        return throwError(() => err);
      }),
    );
  }

  const handleRequestError = (err: any) => {
    if (
      !isBootstrapRequest &&
      authService.hasUsableRefreshToken() &&
      shouldRetryWithRefresh(err)
    ) {
      return authService.refreshToken().pipe(
        switchMap(() => sendRequest()),
        catchError((refreshErr) => {
          if (refreshErr.status === 401 || refreshErr.status === 403) {
            authService.clearSession();
          }
          return throwError(() => refreshErr);
        }),
      );
    }

    return throwError(() => err);
  };

  if (
    !isBootstrapRequest &&
    authService.hasUsableRefreshToken() &&
    (!authService.getAccessToken() || authService.shouldRefreshAccessToken())
  ) {
    return authService.ensureValidSession().pipe(
      switchMap(() => sendRequest()),
      catchError(handleRequestError),
    );
  }

  return sendRequest().pipe(catchError(handleRequestError));
};
