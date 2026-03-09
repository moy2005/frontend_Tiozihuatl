import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../api/services/auth';
import { catchError, switchMap, throwError } from 'rxjs';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const accessToken = localStorage.getItem('accessToken');

  let cloned = req;
  if (accessToken) {
    cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` }
    });
  }

  return next(cloned).pipe(
    catchError((err) => {
      // Nunca reintentar el refresh mismo — corta el loop infinito
      if (req.url.includes('/auth/refresh')) {
        authService.clearSession();
        return throwError(() => err);
      }

      if (err.status === 401 && localStorage.getItem('refreshToken')) {
        return authService.refreshToken().pipe(
          switchMap(() => {
            // Siempre leer el token fresco DESPUÉS de que el service lo guardó
            const freshToken = localStorage.getItem('accessToken');
            if (freshToken) {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${freshToken}` },
              });
              return next(retryReq);
            }
            return throwError(() => err);
          }),
          catchError((refreshErr) => {
            authService.clearSession();
            return throwError(() => refreshErr);
          })
        );
      }

      return throwError(() => err);
    })
  );
};