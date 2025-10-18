import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth';
import { catchError, switchMap, throwError } from 'rxjs';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const accessToken = localStorage.getItem('accessToken');

  // 🔹 Añade el header Authorization automáticamente
  let cloned = req;
  if (accessToken) {
    cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` }
    });
  }

  // 🔹 Si el token expira, intenta renovar automáticamente
  return next(cloned).pipe(
    catchError((err) => {
      if (err.status === 401 && localStorage.getItem('refreshToken')) {
        return authService.refreshToken().pipe(
          switchMap((res: any) => {
            const newAccess = res?.accessToken;
            if (newAccess) {
              localStorage.setItem('accessToken', newAccess);
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newAccess}` },
              });
              return next(retryReq);
            }
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
